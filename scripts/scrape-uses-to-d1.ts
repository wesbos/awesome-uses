import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { setTimeout as delay } from 'node:timers/promises';
import { buildUniqueSlug } from '../src/lib/slug';
import { loadPeopleFromDataJs } from './lib/data-file';
import {
  buildScrapeRecordFromHtml,
  sqlValue,
  type ScrapeRecord,
} from './lib/scrape';
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

async function fetchWithRetry(url: string, timeoutMs: number, retries: number) {
  let lastError: unknown;
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      const response = await fetch(url, {
        method: 'GET',
        redirect: 'follow',
        signal: AbortSignal.timeout(timeoutMs),
        headers: {
          'User-Agent': 'uses.tech-scraper/1.0 (+https://uses.tech)',
          Accept: 'text/html,*/*',
        },
      });
      return response;
    } catch (error) {
      lastError = error;
      if (attempt < retries) {
        await delay(Math.min(300 * (attempt + 1), 1_500));
      }
    }
  }
  throw lastError;
}

async function scrapePage(
  personSlug: string,
  url: string,
  timeoutMs: number,
  retries: number
): Promise<ScrapeRecord> {
  const fetchedAt = new Date().toISOString();
  try {
    const response = await fetchWithRetry(url, timeoutMs, retries);
    const contentType = response.headers.get('content-type') || '';
    const isHtml = contentType.includes('text/html');
    if (!isHtml) {
      return {
        personSlug,
        url,
        statusCode: response.status,
        fetchedAt,
        title: null,
        description: null,
        excerpt: null,
        contentText: null,
        contentHash: null,
        wordCount: null,
        readingMinutes: null,
      };
    }

    const html = await response.text();
    return buildScrapeRecordFromHtml(
      personSlug,
      url,
      response.status,
      html,
      fetchedAt
    );
  } catch (error) {
    return {
      personSlug,
      url,
      statusCode: null,
      fetchedAt,
      title: null,
      description: null,
      excerpt: null,
      contentText: null,
      contentHash: null,
      wordCount: null,
      readingMinutes: null,
    };
  }
}

async function execD1(dbName: string, sql: string, remote: boolean): Promise<void> {
  const args = ['wrangler', 'd1', 'execute', dbName, '--command', sql, '--json'];
  if (remote) {
    args.push('--remote');
  }
  await execFileAsync('npx', args, { cwd: process.cwd() });
}

async function ensureSchema(dbName: string, remote: boolean) {
  const schemaSql = `CREATE TABLE IF NOT EXISTS person_pages (
    person_slug TEXT PRIMARY KEY,
    url TEXT NOT NULL,
    status_code INTEGER,
    fetched_at TEXT NOT NULL,
    title TEXT,
    description TEXT,
    excerpt TEXT,
    content_text TEXT,
    content_hash TEXT,
    word_count INTEGER,
    reading_minutes INTEGER
  );`;
  await execD1(dbName, schemaSql, remote);
}

async function upsertScrape(dbName: string, remote: boolean, row: ScrapeRecord) {
  const sql = `INSERT INTO person_pages (
    person_slug, url, status_code, fetched_at, title, description, excerpt, content_text, content_hash, word_count, reading_minutes
  ) VALUES (
    ${sqlValue(row.personSlug)},
    ${sqlValue(row.url)},
    ${sqlValue(row.statusCode)},
    ${sqlValue(row.fetchedAt)},
    ${sqlValue(row.title)},
    ${sqlValue(row.description)},
    ${sqlValue(row.excerpt)},
    ${sqlValue(row.contentText)},
    ${sqlValue(row.contentHash)},
    ${sqlValue(row.wordCount)},
    ${sqlValue(row.readingMinutes)}
  )
  ON CONFLICT(person_slug) DO UPDATE SET
    url=excluded.url,
    status_code=excluded.status_code,
    fetched_at=excluded.fetched_at,
    title=excluded.title,
    description=excluded.description,
    excerpt=excluded.excerpt,
    content_text=excluded.content_text,
    content_hash=excluded.content_hash,
    word_count=excluded.word_count,
    reading_minutes=excluded.reading_minutes;`;

  await execD1(dbName, sql, remote);
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

  await ensureSchema(options.dbName, options.remote);

  const scraped = await mapConcurrent(people, options.concurrency, async (person, index) => {
    const personSlug = personSlugByUrl.get(person.url) || `person-${index + 1}`;
    const row = await scrapePage(personSlug, person.url, options.timeoutMs, options.retries);
    const statusLabel = row.statusCode ?? 'error';
    console.log(`${String(index + 1).padStart(4, '0')} [${statusLabel}] ${person.url}`);
    await upsertScrape(options.dbName, options.remote, row);
    return row;
  });

  const ok = scraped.filter((row) => row.statusCode && row.statusCode < 400).length;
  const bad = scraped.length - ok;

  console.log('');
  console.log(`Done. Successful scrapes: ${ok}. Failed/invalid: ${bad}.`);
}

void main();
