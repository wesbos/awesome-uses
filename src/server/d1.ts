import { getStartContext } from '@tanstack/start-storage-context';
import type { ScrapedProfileData } from '../lib/types';

type D1Result<T> = { results: T[] };

type D1Statement = {
  bind: (...args: unknown[]) => {
    all: <T>() => Promise<D1Result<T>>;
    first: <T>() => Promise<T | null>;
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

export async function getScrapedProfileBySlug(
  personSlug: string,
  requestContext?: unknown
): Promise<ScrapedProfileData | null> {
  const db =
    resolveD1Database(requestContext) || (await getD1FromCloudflareWorkerModule());
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
