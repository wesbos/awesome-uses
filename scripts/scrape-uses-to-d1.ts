/**
 * @deprecated Use the dashboard UI at /dashboard instead.
 * The "Scrape Pending" / "Re-scrape All" buttons in ScrapeTable and the
 * "Batch Extract" card provide the same functionality via the app's server
 * functions, keeping scraping, extraction, and hashing logic in sync.
 */
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { writeFile, unlink } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { randomBytes } from 'node:crypto';
import { scrapeUsesPage, type ScrapePageResult } from '../src/server/scrape';
import { loadPeopleFromDataJs } from './lib/data-file';
import { sqlValue } from './lib/scrape';
import { buildUniqueSlug } from '../src/lib/slug';
import type { PersonRecord } from '../src/lib/types';

const execFileAsync = promisify(execFile);

type ScrapeOptions = {
  dbName: string;
  remote: boolean;
  concurrency: number;
  timeoutMs: number;
  retries: number;
  limit?: number;
  personFilter?: string;
};

function parseArgs(argv: string[]): ScrapeOptions {
  const readStringFlag = (flag: string): string | undefined => {
    const index = argv.indexOf(flag);
    if (index === -1) return undefined;
    return argv[index + 1];
  };
  const readNumericFlag = (flag: string, fallback: number): number => {
    const value = readStringFlag(flag);
    const parsed = value ? Number(value) : NaN;
    return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
  };

  const limit = readStringFlag('--limit');

  return {
    dbName: readStringFlag('--db') || 'uses-tech-scrapes',
    remote: argv.includes('--remote'),
    concurrency: readNumericFlag('--concurrency', 6),
    timeoutMs: readNumericFlag('--timeout', 12_000),
    retries: readNumericFlag('--retries', 1),
    limit: limit && Number(limit) > 0 ? Number(limit) : undefined,
    personFilter: readStringFlag('--person'),
  };
}

// ---------------------------------------------------------------------------
// D1 helpers (wrangler CLI — only way to reach D1 outside Workers runtime)
// ---------------------------------------------------------------------------

async function execD1(dbName: string, sql: string, remote: boolean): Promise<void> {
  const tmpFile = join(tmpdir(), `d1-${randomBytes(8).toString('hex')}.sql`);
  await writeFile(tmpFile, sql, 'utf-8');
  try {
    const args = ['wrangler', 'd1', 'execute', dbName, '--file', tmpFile, '--json'];
    if (remote) {
      args.push('--remote');
    }
    await execFileAsync('npx', args, { cwd: process.cwd() });
  } finally {
    await unlink(tmpFile).catch(() => {});
  }
}

async function queryD1<T>(
  dbName: string,
  sql: string,
  remote: boolean
): Promise<T[]> {
  const args = ['wrangler', 'd1', 'execute', dbName, '--json', '--command', sql];
  if (remote) {
    args.push('--remote');
  } else {
    args.push('--local');
  }

  const { stdout } = await execFileAsync('npx', args, {
    cwd: process.cwd(),
    maxBuffer: 50 * 1024 * 1024,
  });

  const parsed = JSON.parse(stdout);
  return parsed[0]?.results ?? [];
}

// ---------------------------------------------------------------------------
// Change detection + upsert (mirrors src/server/d1.ts logic)
// ---------------------------------------------------------------------------

type ExistingScrapeRow = {
  contentHash: string | null;
};

function classifyScrapeChangeType(
  previousContentHash: string | null,
  scraped: ScrapePageResult
): 'initial' | 'updated' | 'unchanged' | 'error' | 'non_html' {
  if (scraped.statusCode === null || scraped.statusCode >= 400) return 'error';
  if (!scraped.contentMarkdown) return 'non_html';
  if (!previousContentHash) return 'initial';
  if (previousContentHash !== scraped.contentHash) return 'updated';
  return 'unchanged';
}

async function upsertScrape(
  dbName: string,
  remote: boolean,
  personSlug: string,
  url: string,
  fetchedAt: string,
  scraped: ScrapePageResult,
) {
  const previousRows = await queryD1<ExistingScrapeRow>(
    dbName,
    `SELECT content_hash as contentHash FROM person_pages WHERE person_slug = ${sqlValue(personSlug)} LIMIT 1`,
    remote
  );
  const previousContentHash = previousRows[0]?.contentHash ?? null;
  const changeType = classifyScrapeChangeType(previousContentHash, scraped);

  const sql = `
  INSERT INTO person_pages (
    person_slug, url, status_code, fetched_at, title, content_markdown, content_hash
  ) VALUES (
    ${sqlValue(personSlug)},
    ${sqlValue(url)},
    ${sqlValue(scraped.statusCode)},
    ${sqlValue(fetchedAt)},
    ${sqlValue(scraped.title)},
    ${sqlValue(scraped.contentMarkdown)},
    ${sqlValue(scraped.contentHash)}
  )
  ON CONFLICT(person_slug) DO UPDATE SET
    url=excluded.url,
    status_code=excluded.status_code,
    fetched_at=excluded.fetched_at,
    title=excluded.title,
    content_markdown=excluded.content_markdown,
    content_hash=excluded.content_hash;

  INSERT INTO person_page_events (
    person_slug, url, status_code, fetched_at, content_hash, change_type, title
  ) VALUES (
    ${sqlValue(personSlug)},
    ${sqlValue(url)},
    ${sqlValue(scraped.statusCode)},
    ${sqlValue(fetchedAt)},
    ${sqlValue(scraped.contentHash)},
    ${sqlValue(changeType)},
    ${sqlValue(scraped.title)}
  );
  `;

  await execD1(dbName, sql, remote);
}

// ---------------------------------------------------------------------------
// Concurrency helper
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

function buildPersonSlugMap(people: PersonRecord[]): Map<string, string> {
  const used = new Set<string>();
  const map = new Map<string, string>();
  for (const person of people) {
    map.set(person.url, buildUniqueSlug(person.name, used, 'person'));
  }
  return map;
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const allPeople = await loadPeopleFromDataJs();
  const personSlugByUrl = buildPersonSlugMap(allPeople);

  let people = allPeople;
  if (options.personFilter) {
    const query = options.personFilter.toLowerCase();
    people = people.filter(
      (person) =>
        person.name.toLowerCase().includes(query) ||
        person.url.toLowerCase().includes(query)
    );
  }
  if (options.limit) {
    people = people.slice(0, options.limit);
  }

  if (people.length === 0) {
    console.log('No matching people to scrape.');
    return;
  }

  console.log(
    `Scraping ${people.length} pages to D1 (${options.remote ? 'remote' : 'local'}) database "${options.dbName}"...`
  );

  // Phase 1: scrape pages concurrently using the app's scrapeUsesPage
  const scraped = await mapConcurrent(people, options.concurrency, async (person, index) => {
    const personSlug = personSlugByUrl.get(person.url) || `person-${index + 1}`;
    const result = await scrapeUsesPage(person.url, {
      timeoutMs: options.timeoutMs,
      retries: options.retries,
    });
    const statusLabel = result.statusCode ?? 'error';
    console.log(`${String(index + 1).padStart(4, '0')} [${statusLabel}] ${person.url}`);
    return { personSlug, url: person.url, result };
  });

  // Phase 2: write to D1 sequentially to avoid SQLITE_BUSY
  console.log(`\nWriting ${scraped.length} records to D1...`);
  for (const { personSlug, url, result } of scraped) {
    const fetchedAt = new Date().toISOString();
    await upsertScrape(options.dbName, options.remote, personSlug, url, fetchedAt, result);
  }

  const ok = scraped.filter((s) => s.result.statusCode && s.result.statusCode < 400).length;
  const bad = scraped.length - ok;

  console.log('');
  console.log(`Done. Successful scrapes: ${ok}. Failed/invalid: ${bad}.`);
}

void main();
