import { setTimeout as delay } from 'node:timers/promises';
import {
  getGeneratedPeopleJsonPath,
  loadPeopleFromDataJs,
  writePeopleJsonSnapshot,
  writePeopleToDataJs,
} from './lib/data-file';
import { buildNextPeopleAfterCull } from './lib/cull';

type CullOptions = {
  apply: boolean;
  concurrency: number;
  timeoutMs: number;
  retries: number;
  limit?: number;
};

type ProbeResult = {
  ok: boolean;
  statusCode?: number;
  error?: string;
};

function parseArgs(argv: string[]): CullOptions {
  const apply = argv.includes('--apply');

  const readNumericFlag = (flag: string, fallback: number): number => {
    const index = argv.indexOf(flag);
    if (index === -1) return fallback;
    const value = Number(argv[index + 1]);
    return Number.isFinite(value) && value > 0 ? value : fallback;
  };

  const limitIndex = argv.indexOf('--limit');
  const limit = limitIndex > -1 ? Number(argv[limitIndex + 1]) : undefined;

  return {
    apply,
    concurrency: readNumericFlag('--concurrency', 12),
    timeoutMs: readNumericFlag('--timeout', 10_000),
    retries: readNumericFlag('--retries', 1),
    limit: Number.isFinite(limit) && limit && limit > 0 ? limit : undefined,
  };
}

async function probeUrl(url: string, timeoutMs: number, retries: number): Promise<ProbeResult> {
  let lastError: unknown;

  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      const response = await fetch(url, {
        method: 'GET',
        redirect: 'follow',
        signal: AbortSignal.timeout(timeoutMs),
        headers: {
          'User-Agent': 'uses.tech-cull-script/1.0 (+https://uses.tech)',
          Accept: 'text/html,*/*',
        },
      });

      const ok = response.status >= 200 && response.status < 400;
      if (ok) {
        return { ok: true, statusCode: response.status };
      }
      lastError = new Error(`HTTP ${response.status}`);
      if (attempt < retries) {
        await delay(Math.min(250 * (attempt + 1), 1_000));
      }
    } catch (error) {
      lastError = error;
      if (attempt < retries) {
        await delay(Math.min(250 * (attempt + 1), 1_000));
      }
    }
  }

  return {
    ok: false,
    error: String(lastError),
  };
}

async function mapConcurrent<T, R>(
  values: T[],
  concurrency: number,
  mapper: (value: T, index: number) => Promise<R>
): Promise<R[]> {
  const results: R[] = new Array(values.length);
  let nextIndex = 0;

  async function worker() {
    while (nextIndex < values.length) {
      const current = nextIndex;
      nextIndex += 1;
      results[current] = await mapper(values[current], current);
    }
  }

  await Promise.all(Array.from({ length: Math.min(concurrency, values.length) }, worker));
  return results;
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const allPeople = await loadPeopleFromDataJs();
  const people = options.limit ? allPeople.slice(0, options.limit) : allPeople;

  console.log(`Checking ${people.length} /uses URLs (${options.apply ? 'apply' : 'dry-run'})...`);

  const checks = await mapConcurrent(people, options.concurrency, async (person, index) => {
    const result = await probeUrl(person.url, options.timeoutMs, options.retries);
    const marker = result.ok ? '✓' : '✗';
    console.log(`${String(index + 1).padStart(4, '0')} ${marker} ${person.url}`);
    return { person, result };
  });

  const failed = checks.filter((entry) => !entry.result.ok);
  const { nextPeople, removedCount } = buildNextPeopleAfterCull(
    allPeople,
    checks.map((entry) => ({ url: entry.person.url, ok: entry.result.ok }))
  );

  console.log('');
  console.log(`Valid URLs: ${checks.length - failed.length}`);
  console.log(`Invalid URLs: ${failed.length}`);

  if (failed.length > 0) {
    console.log('');
    console.log('Invalid entries:');
    for (const entry of failed) {
      console.log(
        `- ${entry.person.name} (${entry.person.url}) => ${entry.result.statusCode ?? entry.result.error}`
      );
    }
  }

  if (!options.apply) {
    console.log('');
    console.log('Dry run only. Re-run with --apply to rewrite src/data.js.');
    return;
  }

  await writePeopleToDataJs(nextPeople);
  await writePeopleJsonSnapshot(nextPeople);
  console.log('');
  console.log(
    `Updated src/data.js and ${getGeneratedPeopleJsonPath()}. Removed ${removedCount} entries.`
  );
}

void main();
