import { getStartContext } from '@tanstack/start-storage-context';
import type { ScrapedProfileData } from '../lib/types';
import type { ScrapePageResult } from './scrape';

type D1Result<T> = { results: T[] };

type D1Statement = {
  bind: (...args: unknown[]) => {
    all: <T>() => Promise<D1Result<T>>;
    first: <T>() => Promise<T | null>;
    run?: () => Promise<unknown>;
  };
};

type D1DatabaseLike = {
  prepare: (sql: string) => D1Statement;
};

function getDatabaseFromUnknown(source: unknown): D1DatabaseLike | null {
  if (!source || typeof source !== 'object') return null;
  const candidate = (source as Record<string, unknown>).USES_SCRAPES_DB;
  if (candidate && typeof candidate === 'object' && 'prepare' in candidate) {
    return candidate as D1DatabaseLike;
  }
  return null;
}

function getD1FromRequestContext(requestContext?: unknown): D1DatabaseLike | null {
  if (!requestContext || typeof requestContext !== 'object') return null;

  const contextRecord = requestContext as Record<string, unknown>;
  const direct = getDatabaseFromUnknown(contextRecord);
  if (direct) return direct;

  const env = contextRecord.env;
  const fromEnv = getDatabaseFromUnknown(env);
  if (fromEnv) return fromEnv;

  const cloudflareEnv = (contextRecord.cloudflare as Record<string, unknown> | undefined)?.env;
  const fromCloudflare = getDatabaseFromUnknown(cloudflareEnv);
  if (fromCloudflare) return fromCloudflare;

  return null;
}

function getD1FromStartContext(): D1DatabaseLike | null {
  const startContext = getStartContext({ throwIfNotFound: false });
  if (!startContext) return null;
  return getD1FromRequestContext(startContext.contextAfterGlobalMiddlewares);
}

export function resolveD1Database(requestContext?: unknown): D1DatabaseLike | null {
  return getD1FromRequestContext(requestContext) || getD1FromStartContext();
}

async function getD1FromCloudflareWorkerModule(): Promise<D1DatabaseLike | null> {
  try {
    const cloudflareWorkersModule = await import('cloudflare:workers');
    const env = cloudflareWorkersModule.env as unknown;
    return getDatabaseFromUnknown(env);
  } catch {
    return null;
  }
}

async function resolveD1WithFallback(
  requestContext?: unknown
): Promise<D1DatabaseLike | null> {
  return resolveD1Database(requestContext) || (await getD1FromCloudflareWorkerModule());
}

export async function getScrapedProfileBySlug(
  personSlug: string,
  requestContext?: unknown
): Promise<ScrapedProfileData | null> {
  const db = await resolveD1WithFallback(requestContext);
  if (!db) return null;

  const row = await db
    .prepare(
      `SELECT person_slug as personSlug, url, status_code as statusCode, fetched_at as fetchedAt, title, description, excerpt, word_count as wordCount, reading_minutes as readingMinutes
       FROM person_pages
       WHERE person_slug = ?
       LIMIT 1`
    )
    .bind(personSlug)
    .first<ScrapedProfileData>();

  return row;
}

export async function upsertScrapedProfile(
  personSlug: string,
  url: string,
  fetchedAt: string,
  scraped: ScrapePageResult,
  requestContext?: unknown
): Promise<void> {
  const db = await resolveD1WithFallback(requestContext);
  if (!db) return;

  await db
    .prepare(
      `INSERT INTO person_pages (
        person_slug, url, status_code, fetched_at, title, description, excerpt, content_text, content_hash, word_count, reading_minutes
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
        reading_minutes=excluded.reading_minutes`
    )
    .bind(
      personSlug,
      url,
      scraped.statusCode,
      fetchedAt,
      scraped.title,
      scraped.description,
      scraped.excerpt,
      scraped.contentText,
      scraped.contentHash,
      scraped.wordCount,
      scraped.readingMinutes
    )
    .all<never>();
}
