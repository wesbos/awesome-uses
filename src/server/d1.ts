import { getStartContext } from '@tanstack/start-storage-context';
import type { PersonItem, ScrapedProfileData, ScrapeStatusRow } from '../lib/types';
import { buildUniqueSlug, slugify } from '../lib/slug';
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

  const [result, allItemRows] = await Promise.all([
    db
      .prepare(
        `SELECT item, tags_json, detail
         FROM person_items
         WHERE person_slug = ?
         ORDER BY item`
      )
      .bind(personSlug)
      .all<PersonItemRow>(),
    db
      .prepare(
        `SELECT DISTINCT item
         FROM person_items
         ORDER BY item`
      )
      .bind()
      .all<{ item: string }>(),
  ]);

  const usedItemSlugs = new Set<string>();
  const itemSlugMap = new Map<string, string>();
  for (const row of allItemRows.results) {
    itemSlugMap.set(row.item, buildUniqueSlug(row.item, usedItemSlugs, 'item'));
  }

  return result.results.map((row) => ({
    item: row.item,
    itemSlug: itemSlugMap.get(row.item) || slugify(row.item),
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
  itemSlug: string;
  count: number;
  personSlugs: string[];
};

export type TagSummary = {
  tag: string;
  tagSlug: string;
  totalItems: number;
  totalPeople: number;
  personSlugs: string[];
  topItems: TagItemCount[];
};

export type TagDetail = {
  tag: string;
  tagSlug: string;
  totalItems: number;
  totalPeople: number;
  people: string[];
  items: TagItemCount[];
};

export type ItemRelatedItem = {
  item: string;
  itemSlug: string;
  count: number;
  personSlugs: string[];
};

export type ItemTagRelation = {
  tag: string;
  tagSlug: string;
  people: string[];
  relatedItems: ItemRelatedItem[];
};

export type ItemDetail = {
  item: string;
  itemSlug: string;
  totalPeople: number;
  people: string[];
  tags: string[];
  tagRelations: ItemTagRelation[];
};

export type ItemSearchResult = {
  item: string;
  itemSlug: string;
  count: number;
};

function parseTagsJson(input: string): string[] {
  try {
    const parsed = JSON.parse(input);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((value): value is string => typeof value === 'string');
  } catch {
    return [];
  }
}

function uniqueSorted(values: Iterable<string>): string[] {
  return Array.from(new Set(values)).sort((a, b) => a.localeCompare(b));
}

type ExtractedIndexes = {
  tagToItems: Map<string, Map<string, Set<string>>>;
  tagToPeople: Map<string, Set<string>>;
  itemToPeople: Map<string, Set<string>>;
  itemToTags: Map<string, Set<string>>;
  tagToSlug: Map<string, string>;
  slugToTag: Map<string, string>;
  itemToSlug: Map<string, string>;
  slugToItem: Map<string, string>;
};

function buildExtractedIndexes(rows: AllItemRow[]): ExtractedIndexes {
  const tagToItems = new Map<string, Map<string, Set<string>>>();
  const tagToPeople = new Map<string, Set<string>>();
  const itemToPeople = new Map<string, Set<string>>();
  const itemToTags = new Map<string, Set<string>>();

  for (const row of rows) {
    const item = row.item.trim();
    if (!item) continue;

    const rowTags = parseTagsJson(row.tags_json);

    if (!itemToPeople.has(item)) itemToPeople.set(item, new Set());
    itemToPeople.get(item)?.add(row.person_slug);

    if (!itemToTags.has(item)) itemToTags.set(item, new Set());

    for (const tag of rowTags) {
      const normalizedTag = tag.trim();
      if (!normalizedTag) continue;

      itemToTags.get(item)?.add(normalizedTag);

      if (!tagToItems.has(normalizedTag)) {
        tagToItems.set(normalizedTag, new Map());
      }
      const itemsMap = tagToItems.get(normalizedTag)!;
      if (!itemsMap.has(item)) itemsMap.set(item, new Set());
      itemsMap.get(item)?.add(row.person_slug);

      if (!tagToPeople.has(normalizedTag)) tagToPeople.set(normalizedTag, new Set());
      tagToPeople.get(normalizedTag)?.add(row.person_slug);
    }
  }

  const usedTagSlugs = new Set<string>();
  const tagToSlug = new Map<string, string>();
  const slugToTag = new Map<string, string>();
  for (const tag of uniqueSorted(tagToItems.keys())) {
    const slug = buildUniqueSlug(tag, usedTagSlugs, 'tag');
    tagToSlug.set(tag, slug);
    slugToTag.set(slug, tag);
  }

  const usedItemSlugs = new Set<string>();
  const itemToSlug = new Map<string, string>();
  const slugToItem = new Map<string, string>();
  for (const item of uniqueSorted(itemToPeople.keys())) {
    const slug = buildUniqueSlug(item, usedItemSlugs, 'item');
    itemToSlug.set(item, slug);
    slugToItem.set(slug, item);
  }

  return {
    tagToItems,
    tagToPeople,
    itemToPeople,
    itemToTags,
    tagToSlug,
    slugToTag,
    itemToSlug,
    slugToItem,
  };
}

async function getAllExtractedRows(
  requestContext?: unknown
): Promise<AllItemRow[]> {
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

  return result.results;
}

export async function getAllTagSummaries(
  requestContext?: unknown
): Promise<TagSummary[]> {
  const rows = await getAllExtractedRows(requestContext);
  const indexes = buildExtractedIndexes(rows);

  return [...indexes.tagToItems.entries()]
    .map(([tag, items]) => {
      const topItems = [...items.entries()]
        .sort((a, b) => b[1].size - a[1].size)
        .slice(0, 20)
        .map(([item, people]) => ({
          item,
          itemSlug: indexes.itemToSlug.get(item) || slugify(item),
          count: people.size,
          personSlugs: uniqueSorted(people).slice(0, 10),
        }));

      const people = uniqueSorted(indexes.tagToPeople.get(tag) ?? []);
      return {
        tag,
        tagSlug: indexes.tagToSlug.get(tag) || slugify(tag),
        totalItems: items.size,
        totalPeople: people.length,
        personSlugs: people.slice(0, 30),
        topItems,
      };
    })
    .sort((a, b) => {
      if (b.totalItems !== a.totalItems) return b.totalItems - a.totalItems;
      return a.tag.localeCompare(b.tag);
    });
}

export async function getTagDetailBySlug(
  tagSlug: string,
  requestContext?: unknown
): Promise<TagDetail | null> {
  const rows = await getAllExtractedRows(requestContext);
  const indexes = buildExtractedIndexes(rows);
  const resolvedTag = indexes.slugToTag.get(tagSlug);
  if (!resolvedTag) return null;

  const itemMap = indexes.tagToItems.get(resolvedTag);
  if (!itemMap) return null;

  const items = [...itemMap.entries()]
    .sort((a, b) => b[1].size - a[1].size)
    .map(([item, people]) => ({
      item,
      itemSlug: indexes.itemToSlug.get(item) || slugify(item),
      count: people.size,
      personSlugs: uniqueSorted(people),
    }));

  const people = uniqueSorted(indexes.tagToPeople.get(resolvedTag) ?? []);
  return {
    tag: resolvedTag,
    tagSlug,
    totalItems: itemMap.size,
    totalPeople: people.length,
    people,
    items,
  };
}

export async function getTagDetailByName(
  tagName: string,
  requestContext?: unknown
): Promise<TagDetail | null> {
  const rows = await getAllExtractedRows(requestContext);
  const indexes = buildExtractedIndexes(rows);
  const normalizedTarget = tagName.trim().toLowerCase();

  const resolvedTag = [...indexes.tagToSlug.keys()].find(
    (tag) => tag.toLowerCase() === normalizedTarget
  );

  if (!resolvedTag) return null;

  const slug = indexes.tagToSlug.get(resolvedTag);
  if (!slug) return null;
  return getTagDetailBySlug(slug, requestContext);
}

export async function getItemDetailBySlug(
  itemSlug: string,
  requestContext?: unknown
): Promise<ItemDetail | null> {
  const rows = await getAllExtractedRows(requestContext);
  const indexes = buildExtractedIndexes(rows);
  const resolvedItem = indexes.slugToItem.get(itemSlug);
  if (!resolvedItem) return null;

  const people = uniqueSorted(indexes.itemToPeople.get(resolvedItem) ?? []);
  const tags = uniqueSorted(indexes.itemToTags.get(resolvedItem) ?? []);

  const tagRelations: ItemTagRelation[] = tags.map((tag) => {
    const tagPeople = uniqueSorted(indexes.tagToPeople.get(tag) ?? []);
    const relatedItems = [...(indexes.tagToItems.get(tag)?.entries() ?? [])]
      .filter(([item]) => item !== resolvedItem)
      .sort((a, b) => b[1].size - a[1].size)
      .slice(0, 12)
      .map(([item, itemPeople]) => ({
        item,
        itemSlug: indexes.itemToSlug.get(item) || slugify(item),
        count: itemPeople.size,
        personSlugs: uniqueSorted(itemPeople).slice(0, 20),
      }));

    return {
      tag,
      tagSlug: indexes.tagToSlug.get(tag) || slugify(tag),
      people: tagPeople.slice(0, 40),
      relatedItems,
    };
  });

  return {
    item: resolvedItem,
    itemSlug,
    totalPeople: people.length,
    people,
    tags,
    tagRelations,
  };
}

export async function getItemDetailByName(
  itemName: string,
  requestContext?: unknown
): Promise<ItemDetail | null> {
  const rows = await getAllExtractedRows(requestContext);
  const indexes = buildExtractedIndexes(rows);
  const normalizedTarget = itemName.trim().toLowerCase();
  const resolvedItem = [...indexes.itemToSlug.keys()].find(
    (item) => item.toLowerCase() === normalizedTarget
  );
  if (!resolvedItem) return null;
  const slug = indexes.itemToSlug.get(resolvedItem);
  if (!slug) return null;
  return getItemDetailBySlug(slug, requestContext);
}

export async function searchItems(
  query: string,
  requestContext?: unknown
): Promise<ItemSearchResult[]> {
  const db = await resolveD1WithFallback(requestContext);
  if (!db) return [];

  const trimmed = query.trim();
  if (!trimmed) return [];

  const result = await db
    .prepare(
      `SELECT item, COUNT(DISTINCT person_slug) as count
       FROM person_items
       WHERE item LIKE ?
       GROUP BY item
       ORDER BY count DESC, item ASC
       LIMIT 25`
    )
    .bind(`%${trimmed}%`)
    .all<{ item: string; count: number }>();

  const usedItemSlugs = new Set<string>();
  return result.results.map((row) => ({
    item: row.item,
    itemSlug: buildUniqueSlug(row.item, usedItemSlugs, 'item'),
    count: row.count,
  }));
}

export type MergeItemsResult = {
  canonicalItem: string;
  mergedItems: string[];
  affectedPeople: number;
  upsertedRows: number;
  deletedRows: number;
};

type MergeSourceRow = {
  person_slug: string;
  item: string;
  tags_json: string;
  detail: string | null;
  extracted_at: string;
};

function maxIsoDate(values: string[]): string {
  return values.sort((a, b) => b.localeCompare(a))[0] || new Date().toISOString();
}

export async function mergeItemsIntoCanonical(
  canonicalItem: string,
  sourceItems: string[],
  requestContext?: unknown
): Promise<MergeItemsResult> {
  const db = await resolveD1WithFallback(requestContext);
  const canonical = canonicalItem.trim();
  const dedupedSourceItems = uniqueSorted(
    sourceItems.map((item) => item.trim()).filter((item) => item && item !== canonical)
  );

  if (!db || !canonical || dedupedSourceItems.length === 0) {
    return {
      canonicalItem: canonical,
      mergedItems: dedupedSourceItems,
      affectedPeople: 0,
      upsertedRows: 0,
      deletedRows: 0,
    };
  }

  const targets = [canonical, ...dedupedSourceItems];
  const placeholders = targets.map(() => '?').join(', ');

  const sourceResult = await db
    .prepare(
      `SELECT person_slug, item, tags_json, detail, extracted_at
       FROM person_items
       WHERE item IN (${placeholders})`
    )
    .bind(...targets)
    .all<MergeSourceRow>();

  const byPerson = new Map<string, MergeSourceRow[]>();
  for (const row of sourceResult.results) {
    if (!byPerson.has(row.person_slug)) byPerson.set(row.person_slug, []);
    byPerson.get(row.person_slug)?.push(row);
  }

  let affectedPeople = 0;
  let upsertedRows = 0;
  let deletedRows = 0;

  for (const [personSlug, rows] of byPerson.entries()) {
    const sourceRows = rows.filter((row) => dedupedSourceItems.includes(row.item));
    if (sourceRows.length === 0) continue;

    affectedPeople += 1;
    const canonicalRow = rows.find((row) => row.item === canonical);
    const mergedTags = uniqueSorted(
      rows.flatMap((row) => parseTagsJson(row.tags_json))
    );
    const mergedDetail =
      canonicalRow?.detail ?? sourceRows.find((row) => row.detail)?.detail ?? null;
    const mergedExtractedAt = maxIsoDate(rows.map((row) => row.extracted_at));

    await db
      .prepare(
        `INSERT INTO person_items (person_slug, item, tags_json, detail, extracted_at)
         VALUES (?, ?, ?, ?, ?)
         ON CONFLICT(person_slug, item) DO UPDATE SET
           tags_json=excluded.tags_json,
           detail=COALESCE(excluded.detail, person_items.detail),
           extracted_at=excluded.extracted_at`
      )
      .bind(
        personSlug,
        canonical,
        JSON.stringify(mergedTags),
        mergedDetail,
        mergedExtractedAt
      )
      .all<never>();
    upsertedRows += 1;

    for (const source of sourceRows) {
      await db
        .prepare(
          `DELETE FROM person_items
           WHERE person_slug = ? AND item = ?`
        )
        .bind(personSlug, source.item)
        .all<never>();
      deletedRows += 1;
    }
  }

  return {
    canonicalItem: canonical,
    mergedItems: dedupedSourceItems,
    affectedPeople,
    upsertedRows,
    deletedRows,
  };
}

export type ScrapeChangeType =
  | 'initial'
  | 'updated'
  | 'unchanged'
  | 'error'
  | 'non_html';

export type ScrapeEventRow = {
  id: number;
  personSlug: string;
  url: string;
  statusCode: number | null;
  fetchedAt: string;
  contentHash: string | null;
  changeType: ScrapeChangeType;
  title: string | null;
};

export type ScrapeHistoryStats = {
  totalEvents: number;
  initialEvents: number;
  updatedEvents: number;
  unchangedEvents: number;
  errorEvents: number;
  nonHtmlEvents: number;
  peopleUpdated: number;
  lastEventAt: string | null;
};

export type PersonScrapeHistoryRow = {
  personSlug: string;
  scrapeCount: number;
  updateCount: number;
  lastScrapedAt: string | null;
  lastUpdatedAt: string | null;
};

type ExistingScrapeSnapshot = {
  contentHash: string | null;
};

function classifyScrapeChangeType(
  previous: ExistingScrapeSnapshot | null,
  scraped: ScrapePageResult
): ScrapeChangeType {
  if (scraped.statusCode === null || scraped.statusCode >= 400) {
    return 'error';
  }

  if (!scraped.contentMarkdown) {
    return 'non_html';
  }

  if (!previous) {
    return 'initial';
  }

  if (previous.contentHash !== scraped.contentHash) {
    return 'updated';
  }

  return 'unchanged';
}

export async function getRecentScrapeEvents(
  limit = 100,
  requestContext?: unknown
): Promise<ScrapeEventRow[]> {
  const db = await resolveD1WithFallback(requestContext);
  if (!db) return [];

  const safeLimit = Math.max(1, Math.min(limit, 500));
  const result = await db
    .prepare(
      `SELECT id, person_slug as personSlug, url, status_code as statusCode, fetched_at as fetchedAt, content_hash as contentHash, change_type as changeType, title
       FROM person_page_events
       ORDER BY fetched_at DESC
       LIMIT ?`
    )
    .bind(safeLimit)
    .all<ScrapeEventRow>();

  return result.results;
}

export async function getScrapeHistoryStats(
  requestContext?: unknown
): Promise<ScrapeHistoryStats> {
  const db = await resolveD1WithFallback(requestContext);
  if (!db) {
    return {
      totalEvents: 0,
      initialEvents: 0,
      updatedEvents: 0,
      unchangedEvents: 0,
      errorEvents: 0,
      nonHtmlEvents: 0,
      peopleUpdated: 0,
      lastEventAt: null,
    };
  }

  const row = await db
    .prepare(
      `SELECT
          COUNT(*) as totalEvents,
          SUM(CASE WHEN change_type = 'initial' THEN 1 ELSE 0 END) as initialEvents,
          SUM(CASE WHEN change_type = 'updated' THEN 1 ELSE 0 END) as updatedEvents,
          SUM(CASE WHEN change_type = 'unchanged' THEN 1 ELSE 0 END) as unchangedEvents,
          SUM(CASE WHEN change_type = 'error' THEN 1 ELSE 0 END) as errorEvents,
          SUM(CASE WHEN change_type = 'non_html' THEN 1 ELSE 0 END) as nonHtmlEvents,
          COUNT(DISTINCT CASE WHEN change_type = 'updated' THEN person_slug END) as peopleUpdated,
          MAX(fetched_at) as lastEventAt
       FROM person_page_events`
    )
    .bind()
    .first<{
      totalEvents: number | null;
      initialEvents: number | null;
      updatedEvents: number | null;
      unchangedEvents: number | null;
      errorEvents: number | null;
      nonHtmlEvents: number | null;
      peopleUpdated: number | null;
      lastEventAt: string | null;
    }>();

  return {
    totalEvents: row?.totalEvents ?? 0,
    initialEvents: row?.initialEvents ?? 0,
    updatedEvents: row?.updatedEvents ?? 0,
    unchangedEvents: row?.unchangedEvents ?? 0,
    errorEvents: row?.errorEvents ?? 0,
    nonHtmlEvents: row?.nonHtmlEvents ?? 0,
    peopleUpdated: row?.peopleUpdated ?? 0,
    lastEventAt: row?.lastEventAt ?? null,
  };
}

export async function getPersonScrapeHistory(
  requestContext?: unknown
): Promise<PersonScrapeHistoryRow[]> {
  const db = await resolveD1WithFallback(requestContext);
  if (!db) return [];

  const result = await db
    .prepare(
      `SELECT
          person_slug as personSlug,
          COUNT(*) as scrapeCount,
          SUM(CASE WHEN change_type = 'updated' THEN 1 ELSE 0 END) as updateCount,
          MAX(fetched_at) as lastScrapedAt,
          MAX(CASE WHEN change_type IN ('initial', 'updated') THEN fetched_at END) as lastUpdatedAt
       FROM person_page_events
       GROUP BY person_slug
       ORDER BY lastScrapedAt DESC`
    )
    .bind()
    .all<PersonScrapeHistoryRow>();

  return result.results;
}

export type AmazonCacheRow = {
  itemKey: string;
  query: string;
  marketplace: string;
  payloadJson: string;
  fetchedAt: string;
  expiresAt: string;
};

export async function getAmazonCacheByItemKey(
  itemKey: string,
  marketplace: string,
  requestContext?: unknown
): Promise<AmazonCacheRow | null> {
  const db = await resolveD1WithFallback(requestContext);
  if (!db) return null;

  const row = await db
    .prepare(
      `SELECT item_key as itemKey, query, marketplace, payload_json as payloadJson, fetched_at as fetchedAt, expires_at as expiresAt
       FROM amazon_item_cache
       WHERE item_key = ? AND marketplace = ? AND expires_at > ?
       LIMIT 1`
    )
    .bind(itemKey, marketplace, new Date().toISOString())
    .first<AmazonCacheRow>();

  return row;
}

export async function upsertAmazonCache(
  itemKey: string,
  query: string,
  marketplace: string,
  payloadJson: string,
  expiresAt: string,
  requestContext?: unknown
): Promise<void> {
  const db = await resolveD1WithFallback(requestContext);
  if (!db) return;

  const fetchedAt = new Date().toISOString();
  await db
    .prepare(
      `INSERT INTO amazon_item_cache (item_key, query, marketplace, payload_json, fetched_at, expires_at)
       VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT(item_key) DO UPDATE SET
         query=excluded.query,
         marketplace=excluded.marketplace,
         payload_json=excluded.payload_json,
         fetched_at=excluded.fetched_at,
         expires_at=excluded.expires_at`
    )
    .bind(itemKey, query, marketplace, payloadJson, fetchedAt, expiresAt)
    .all<never>();
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

  const previous = await db
    .prepare(
      `SELECT content_hash as contentHash
       FROM person_pages
       WHERE person_slug = ?
       LIMIT 1`
    )
    .bind(personSlug)
    .first<ExistingScrapeSnapshot>();

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

  const changeType = classifyScrapeChangeType(previous, scraped);

  try {
    await db
      .prepare(
        `INSERT INTO person_page_events (
          person_slug, url, status_code, fetched_at, content_hash, change_type, title
        ) VALUES (?, ?, ?, ?, ?, ?, ?)`
      )
      .bind(
        personSlug,
        url,
        scraped.statusCode,
        fetchedAt,
        scraped.contentHash,
        changeType,
        scraped.title
      )
      .all<never>();
  } catch {
    // no-op: avoid failing scrape writes when migrations are not yet applied
  }
}
