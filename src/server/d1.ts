import { getStartContext } from '@tanstack/start-storage-context';
import type { PersonItem, ScrapedProfileData, ScrapeStatusRow } from '../lib/types';
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
      `SELECT person_slug as personSlug, url, status_code as statusCode, fetched_at as fetchedAt, title, content_markdown as contentMarkdown
       FROM person_pages
       WHERE person_slug = ?
       LIMIT 1`
    )
    .bind(personSlug)
    .first<ScrapedProfileData>();

  return row;
}

export async function getAllScrapeSummaries(
  requestContext?: unknown
): Promise<ScrapeStatusRow[]> {
  const db = await resolveD1WithFallback(requestContext);
  if (!db) return [];

  const result = await db
    .prepare(
      `SELECT person_slug as personSlug, url, status_code as statusCode, fetched_at as fetchedAt, title
       FROM person_pages
       ORDER BY fetched_at DESC`
    )
    .bind()
    .all<ScrapeStatusRow>();

  return result.results;
}

type PersonItemRow = {
  item: string;
  tags_json: string;
  detail: string | null;
};

export async function getPersonItems(
  personSlug: string,
  requestContext?: unknown
): Promise<PersonItem[]> {
  const db = await resolveD1WithFallback(requestContext);
  if (!db) return [];

  const result = await db
    .prepare(
      `SELECT item, tags_json, detail
       FROM person_items
       WHERE person_slug = ?
       ORDER BY item`
    )
    .bind(personSlug)
    .all<PersonItemRow>();

  return result.results.map((row) => ({
    item: row.item,
    tags: JSON.parse(row.tags_json),
    detail: row.detail,
  }));
}

type AllItemRow = {
  item: string;
  tags_json: string;
  person_slug: string;
};

export type TagItemCount = {
  item: string;
  count: number;
};

export type TagSummary = {
  tag: string;
  totalItems: number;
  topItems: TagItemCount[];
};

export async function getAllTagSummaries(
  requestContext?: unknown
): Promise<TagSummary[]> {
  const db = await resolveD1WithFallback(requestContext);
  if (!db) return [];

  const result = await db
    .prepare(
      `SELECT item, tags_json, person_slug
       FROM person_items
       ORDER BY item`
    )
    .bind()
    .all<AllItemRow>();

  const tagMap = new Map<string, Map<string, number>>();

  for (const row of result.results) {
    const tags: string[] = JSON.parse(row.tags_json);
    for (const tag of tags) {
      if (!tagMap.has(tag)) tagMap.set(tag, new Map());
      const items = tagMap.get(tag)!;
      items.set(row.item, (items.get(row.item) || 0) + 1);
    }
  }

  return [...tagMap.entries()]
    .map(([tag, items]) => {
      const sorted = [...items.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 20)
        .map(([item, count]) => ({ item, count }));
      return { tag, totalItems: items.size, topItems: sorted };
    })
    .sort((a, b) => b.totalItems - a.totalItems);
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
        person_slug, url, status_code, fetched_at, title, content_markdown, content_hash
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(person_slug) DO UPDATE SET
        url=excluded.url,
        status_code=excluded.status_code,
        fetched_at=excluded.fetched_at,
        title=excluded.title,
        content_markdown=excluded.content_markdown,
        content_hash=excluded.content_hash`
    )
    .bind(
      personSlug,
      url,
      scraped.statusCode,
      fetchedAt,
      scraped.title,
      scraped.contentMarkdown,
      scraped.contentHash
    )
    .all<never>();
}
