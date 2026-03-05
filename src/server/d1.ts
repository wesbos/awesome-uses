import { env as cfEnv } from 'cloudflare:workers';
import { drizzle, type DrizzleD1Database } from 'drizzle-orm/d1';
import { eq, like, and, gt, sql, desc, asc, inArray } from 'drizzle-orm';
import type { PersonItem, ScrapedProfileData, ScrapeStatusRow } from '../lib/types';
import { buildUniqueSlug, slugify } from '../lib/slug';
import type { ScrapePageResult } from './scrape';
import * as schema from './schema';

type D1Env = { USES_SCRAPES_DB?: Parameters<typeof drizzle>[0] };

function resolveDb(): DrizzleD1Database<typeof schema> | null {
  const d1 = (cfEnv as D1Env).USES_SCRAPES_DB;
  if (!d1) return null;
  return drizzle(d1, { schema });
}

export async function getScrapedProfileBySlug(
  personSlug: string,
): Promise<ScrapedProfileData | null> {
  const db = resolveDb();
  if (!db) return null;

  const row = await db
    .select({
      personSlug: schema.personPages.personSlug,
      url: schema.personPages.url,
      statusCode: schema.personPages.statusCode,
      fetchedAt: schema.personPages.fetchedAt,
      title: schema.personPages.title,
      contentMarkdown: schema.personPages.contentMarkdown,
    })
    .from(schema.personPages)
    .where(eq(schema.personPages.personSlug, personSlug))
    .limit(1)
    .then((rows) => rows[0] ?? null);

  return row;
}

export async function getAllScrapeSummaries(): Promise<ScrapeStatusRow[]> {
  const db = resolveDb();
  if (!db) return [];

  return db
    .select({
      personSlug: schema.personPages.personSlug,
      url: schema.personPages.url,
      statusCode: schema.personPages.statusCode,
      fetchedAt: schema.personPages.fetchedAt,
      title: schema.personPages.title,
    })
    .from(schema.personPages)
    .orderBy(desc(schema.personPages.fetchedAt));
}

type PersonItemRow = {
  item: string;
  tags_json: string;
  detail: string | null;
};

export async function getPersonItems(
  personSlug: string,
): Promise<PersonItem[]> {
  const db = resolveDb();
  if (!db) return [];

  const [result, allItemRows] = await Promise.all([
    db
      .select({
        item: schema.personItems.item,
        tags_json: schema.personItems.tagsJson,
        detail: schema.personItems.detail,
      })
      .from(schema.personItems)
      .where(eq(schema.personItems.personSlug, personSlug))
      .orderBy(asc(schema.personItems.item)),
    db
      .selectDistinct({ item: schema.personItems.item })
      .from(schema.personItems)
      .orderBy(asc(schema.personItems.item)),
  ]);

  const usedItemSlugs = new Set<string>();
  const itemSlugMap = new Map<string, string>();
  for (const row of allItemRows) {
    itemSlugMap.set(row.item, buildUniqueSlug(row.item, usedItemSlugs, 'item'));
  }

  return result.map((row) => ({
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

async function getAllExtractedRows(): Promise<AllItemRow[]> {
  const db = resolveDb();
  if (!db) return [];

  try {
    const rows = await db
      .select({
        item: schema.personItems.item,
        tags_json: schema.personItems.tagsJson,
        person_slug: schema.personItems.personSlug,
      })
      .from(schema.personItems)
      .orderBy(asc(schema.personItems.item));

    return rows;
  } catch {
    return [];
  }
}

export async function getAllTagSummaries(): Promise<TagSummary[]> {
  const rows = await getAllExtractedRows();
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
): Promise<TagDetail | null> {
  const rows = await getAllExtractedRows();
  const indexes = buildExtractedIndexes(rows);
  const resolvedTag =
    indexes.slugToTag.get(tagSlug) ||
    [...indexes.tagToSlug.keys()].find((tag) => slugify(tag) === tagSlug);
  if (!resolvedTag) return null;

  const itemMap = indexes.tagToItems.get(resolvedTag);
  if (!itemMap) return null;

  const tagItems = [...itemMap.entries()]
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
    items: tagItems,
  };
}

export async function getTagDetailByName(
  tagName: string,
): Promise<TagDetail | null> {
  const rows = await getAllExtractedRows();
  const indexes = buildExtractedIndexes(rows);
  const normalizedTarget = tagName.trim().toLowerCase();

  const resolvedTag = [...indexes.tagToSlug.keys()].find(
    (tag) => tag.toLowerCase() === normalizedTarget
  );

  if (!resolvedTag) return null;

  const slug = indexes.tagToSlug.get(resolvedTag);
  if (!slug) return null;
  return getTagDetailBySlug(slug);
}

export async function getItemDetailBySlug(
  itemSlug: string,
): Promise<ItemDetail | null> {
  const rows = await getAllExtractedRows();
  const indexes = buildExtractedIndexes(rows);
  const resolvedItem =
    indexes.slugToItem.get(itemSlug) ||
    [...indexes.itemToSlug.keys()].find((item) => slugify(item) === itemSlug);
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
): Promise<ItemDetail | null> {
  const rows = await getAllExtractedRows();
  const indexes = buildExtractedIndexes(rows);
  const normalizedTarget = itemName.trim().toLowerCase();
  const resolvedItem = [...indexes.itemToSlug.keys()].find(
    (item) => item.toLowerCase() === normalizedTarget
  );
  if (!resolvedItem) return null;
  const slug = indexes.itemToSlug.get(resolvedItem);
  if (!slug) return null;
  return getItemDetailBySlug(slug);
}

export async function searchItems(
  query: string,
): Promise<ItemSearchResult[]> {
  const db = resolveDb();
  if (!db) throw new Error('Database not available (D1 binding missing)');

  const trimmed = query.trim();
  if (!trimmed) return [];

  const rows = await db
    .select({
      item: schema.personItems.item,
      count: sql<number>`COUNT(DISTINCT ${schema.personItems.personSlug})`,
    })
    .from(schema.personItems)
    .where(like(schema.personItems.item, `%${trimmed}%`))
    .groupBy(schema.personItems.item)
    .orderBy(sql`count DESC`, asc(schema.personItems.item))
    .limit(25);

  const usedItemSlugs = new Set<string>();
  return rows.map((row) => ({
    item: row.item,
    itemSlug: buildUniqueSlug(row.item, usedItemSlugs, 'item'),
    count: row.count,
  }));
}

export async function getExtractedCategories(): Promise<string[]> {
  const db = resolveDb();
  if (!db) return [];

  try {
    const rows = await db.all<{ category: string }>(
      sql`SELECT DISTINCT j.value as category
          FROM person_items, json_each(person_items.tags_json) j
          ORDER BY category`
    );

    return rows.map((row) => row.category).filter(Boolean);
  } catch {
    return [];
  }
}

export type ReclassifyCandidate = {
  item: string;
  count: number;
  people: string[];
};

export async function getReclassifyCandidates(
  category: string,
  minUsers: number,
  limit: number,
): Promise<ReclassifyCandidate[]> {
  const db = resolveDb();
  if (!db) return [];

  const safeCategory = category.trim();
  if (!safeCategory) return [];

  const safeMinUsers = Math.max(1, minUsers);
  const safeLimit = Math.max(1, Math.min(limit, 500));

  try {
    const rows = await db.all<{ item: string; count: number; people: string | null }>(
      sql`SELECT
            item,
            COUNT(DISTINCT person_slug) as count,
            GROUP_CONCAT(DISTINCT person_slug) as people
          FROM person_items
          WHERE tags_json LIKE ${`%"${safeCategory}"%`}
          GROUP BY item
          HAVING count >= ${safeMinUsers}
          ORDER BY count DESC, item ASC
          LIMIT ${safeLimit}`
    );

    return rows.map((row) => ({
      item: row.item,
      count: row.count,
      people: row.people ? row.people.split(',').filter(Boolean) : [],
    }));
  } catch {
    return [];
  }
}

export type ReclassifyAssignment = {
  item: string;
  categories: string[];
};

export type ReclassifyApplyResult = {
  updatedRows: number;
  updatedItems: number;
};

export async function applyTagReclassification(
  category: string,
  assignments: ReclassifyAssignment[],
): Promise<ReclassifyApplyResult> {
  const db = resolveDb();
  if (!db) return { updatedRows: 0, updatedItems: 0 };

  const normalizedCategory = category.trim();
  if (!normalizedCategory) return { updatedRows: 0, updatedItems: 0 };

  const assignmentMap = new Map<string, string[]>();
  for (const assignment of assignments) {
    const item = assignment.item.trim();
    if (!item) continue;
    const categories = uniqueSorted(
      assignment.categories.map((entry) => entry.trim()).filter(Boolean)
    );
    if (categories.length === 0) continue;
    assignmentMap.set(item, categories);
  }

  if (assignmentMap.size === 0) {
    return { updatedRows: 0, updatedItems: 0 };
  }

  const rows = await db
    .select({
      personSlug: schema.personItems.personSlug,
      item: schema.personItems.item,
      tagsJson: schema.personItems.tagsJson,
    })
    .from(schema.personItems)
    .where(like(schema.personItems.tagsJson, `%"${normalizedCategory}"%`));

  let updatedRows = 0;
  const touchedItems = new Set<string>();

  for (const row of rows) {
    const nextCategories = assignmentMap.get(row.item);
    if (!nextCategories) continue;

    const currentTags = parseTagsJson(row.tagsJson);
    const withoutOld = currentTags.filter((entry) => entry !== normalizedCategory);
    const merged = uniqueSorted([...withoutOld, ...nextCategories]);
    const mergedJson = JSON.stringify(merged);

    if (mergedJson === row.tagsJson) continue;

    await db
      .update(schema.personItems)
      .set({ tagsJson: mergedJson })
      .where(
        and(
          eq(schema.personItems.personSlug, row.personSlug),
          eq(schema.personItems.item, row.item),
        )
      );

    touchedItems.add(row.item);
    updatedRows += 1;
  }

  return {
    updatedRows,
    updatedItems: touchedItems.size,
  };
}

export type MergeItemsResult = {
  canonicalItem: string;
  mergedItems: string[];
  affectedPeople: number;
  upsertedRows: number;
  deletedRows: number;
};

type MergeSourceRow = {
  personSlug: string;
  item: string;
  tagsJson: string;
  detail: string | null;
  extractedAt: string;
};

function maxIsoDate(values: string[]): string {
  return values.sort((a, b) => b.localeCompare(a))[0] || new Date().toISOString();
}

export async function mergeItemsIntoCanonical(
  canonicalItem: string,
  sourceItems: string[],
): Promise<MergeItemsResult> {
  const db = resolveDb();
  if (!db) throw new Error('Database not available (D1 binding missing)');

  const canonical = canonicalItem.trim();
  if (!canonical) throw new Error('Canonical item name is required');

  const dedupedSourceItems = uniqueSorted(
    sourceItems.map((item) => item.trim()).filter((item) => item && item !== canonical)
  );

  if (dedupedSourceItems.length === 0) {
    throw new Error('At least one source item to merge is required');
  }

  const targets = [canonical, ...dedupedSourceItems];

  const sourceResult = await db
    .select({
      personSlug: schema.personItems.personSlug,
      item: schema.personItems.item,
      tagsJson: schema.personItems.tagsJson,
      detail: schema.personItems.detail,
      extractedAt: schema.personItems.extractedAt,
    })
    .from(schema.personItems)
    .where(inArray(schema.personItems.item, targets));

  const byPerson = new Map<string, MergeSourceRow[]>();
  for (const row of sourceResult) {
    if (!byPerson.has(row.personSlug)) byPerson.set(row.personSlug, []);
    byPerson.get(row.personSlug)?.push(row);
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
      rows.flatMap((row) => parseTagsJson(row.tagsJson))
    );
    const mergedDetail =
      canonicalRow?.detail ?? sourceRows.find((row) => row.detail)?.detail ?? null;
    const mergedExtractedAt = maxIsoDate(rows.map((row) => row.extractedAt));

    await db
      .insert(schema.personItems)
      .values({
        personSlug,
        item: canonical,
        tagsJson: JSON.stringify(mergedTags),
        detail: mergedDetail,
        extractedAt: mergedExtractedAt,
      })
      .onConflictDoUpdate({
        target: [schema.personItems.personSlug, schema.personItems.item],
        set: {
          tagsJson: JSON.stringify(mergedTags),
          detail: sql`COALESCE(excluded.detail, ${schema.personItems.detail})`,
          extractedAt: mergedExtractedAt,
        },
      });
    upsertedRows += 1;

    for (const source of sourceRows) {
      await db
        .delete(schema.personItems)
        .where(
          and(
            eq(schema.personItems.personSlug, personSlug),
            eq(schema.personItems.item, source.item),
          )
        );
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
): Promise<ScrapeEventRow[]> {
  const db = resolveDb();
  if (!db) return [];

  const safeLimit = Math.max(1, Math.min(limit, 500));
  try {
    const rows = await db
      .select({
        id: schema.personPageEvents.id,
        personSlug: schema.personPageEvents.personSlug,
        url: schema.personPageEvents.url,
        statusCode: schema.personPageEvents.statusCode,
        fetchedAt: schema.personPageEvents.fetchedAt,
        contentHash: schema.personPageEvents.contentHash,
        changeType: schema.personPageEvents.changeType,
        title: schema.personPageEvents.title,
      })
      .from(schema.personPageEvents)
      .orderBy(desc(schema.personPageEvents.fetchedAt))
      .limit(safeLimit);
    return rows as ScrapeEventRow[];
  } catch {
    return [];
  }
}

export async function getScrapeHistoryStats(): Promise<ScrapeHistoryStats> {
  const db = resolveDb();
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

  try {
    const row = await db.get<{
      totalEvents: number | null;
      initialEvents: number | null;
      updatedEvents: number | null;
      unchangedEvents: number | null;
      errorEvents: number | null;
      nonHtmlEvents: number | null;
      peopleUpdated: number | null;
      lastEventAt: string | null;
    }>(
      sql`SELECT
            COUNT(*) as totalEvents,
            SUM(CASE WHEN change_type = 'initial' THEN 1 ELSE 0 END) as initialEvents,
            SUM(CASE WHEN change_type = 'updated' THEN 1 ELSE 0 END) as updatedEvents,
            SUM(CASE WHEN change_type = 'unchanged' THEN 1 ELSE 0 END) as unchangedEvents,
            SUM(CASE WHEN change_type = 'error' THEN 1 ELSE 0 END) as errorEvents,
            SUM(CASE WHEN change_type = 'non_html' THEN 1 ELSE 0 END) as nonHtmlEvents,
            COUNT(DISTINCT CASE WHEN change_type = 'updated' THEN person_slug END) as peopleUpdated,
            MAX(fetched_at) as lastEventAt
          FROM person_page_events`
    );

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
  } catch {
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
}

export async function getPersonScrapeHistory(): Promise<PersonScrapeHistoryRow[]> {
  const db = resolveDb();
  if (!db) return [];

  try {
    return await db.all<PersonScrapeHistoryRow>(
      sql`SELECT
            person_slug as personSlug,
            COUNT(*) as scrapeCount,
            SUM(CASE WHEN change_type = 'updated' THEN 1 ELSE 0 END) as updateCount,
            MAX(fetched_at) as lastScrapedAt,
            MAX(CASE WHEN change_type IN ('initial', 'updated') THEN fetched_at END) as lastUpdatedAt
          FROM person_page_events
          GROUP BY person_slug
          ORDER BY lastScrapedAt DESC`
    );
  } catch {
    return [];
  }
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
): Promise<AmazonCacheRow | null> {
  const db = resolveDb();
  if (!db) return null;

  const row = await db
    .select({
      itemKey: schema.amazonItemCache.itemKey,
      query: schema.amazonItemCache.query,
      marketplace: schema.amazonItemCache.marketplace,
      payloadJson: schema.amazonItemCache.payloadJson,
      fetchedAt: schema.amazonItemCache.fetchedAt,
      expiresAt: schema.amazonItemCache.expiresAt,
    })
    .from(schema.amazonItemCache)
    .where(
      and(
        eq(schema.amazonItemCache.itemKey, itemKey),
        eq(schema.amazonItemCache.marketplace, marketplace),
        gt(schema.amazonItemCache.expiresAt, new Date().toISOString()),
      )
    )
    .limit(1)
    .then((rows) => rows[0] ?? null);

  return row;
}

export async function upsertAmazonCache(
  itemKey: string,
  query: string,
  marketplace: string,
  payloadJson: string,
  expiresAt: string,
): Promise<void> {
  const db = resolveDb();
  if (!db) return;

  const fetchedAt = new Date().toISOString();
  await db
    .insert(schema.amazonItemCache)
    .values({ itemKey, query, marketplace, payloadJson, fetchedAt, expiresAt })
    .onConflictDoUpdate({
      target: schema.amazonItemCache.itemKey,
      set: {
        query,
        marketplace,
        payloadJson,
        fetchedAt,
        expiresAt,
      },
    });
}

export async function upsertScrapedProfile(
  personSlug: string,
  url: string,
  fetchedAt: string,
  scraped: ScrapePageResult,
): Promise<void> {
  const db = resolveDb();
  if (!db) return;

  const previous = await db
    .select({ contentHash: schema.personPages.contentHash })
    .from(schema.personPages)
    .where(eq(schema.personPages.personSlug, personSlug))
    .limit(1)
    .then((rows) => rows[0] ?? null);

  await db
    .insert(schema.personPages)
    .values({
      personSlug,
      url,
      statusCode: scraped.statusCode,
      fetchedAt,
      title: scraped.title,
      contentMarkdown: scraped.contentMarkdown,
      contentHash: scraped.contentHash,
    })
    .onConflictDoUpdate({
      target: schema.personPages.personSlug,
      set: {
        url,
        statusCode: scraped.statusCode,
        fetchedAt,
        title: scraped.title,
        contentMarkdown: scraped.contentMarkdown,
        contentHash: scraped.contentHash,
      },
    });

  const changeType = classifyScrapeChangeType(previous, scraped);

  try {
    await db
      .insert(schema.personPageEvents)
      .values({
        personSlug,
        url,
        statusCode: scraped.statusCode,
        fetchedAt,
        contentHash: scraped.contentHash,
        changeType,
        title: scraped.title,
      });
  } catch {
    // no-op: avoid failing scrape writes when migrations are not yet applied
  }
}

export async function getErrorPeople(): Promise<Array<{
  personSlug: string;
  url: string;
  statusCode: number | null;
  fetchedAt: string;
  title: string | null;
}>> {
  const db = resolveDb();
  if (!db) return [];

  try {
    return await db
      .select({
        personSlug: schema.personPages.personSlug,
        url: schema.personPages.url,
        statusCode: schema.personPages.statusCode,
        fetchedAt: schema.personPages.fetchedAt,
        title: schema.personPages.title,
      })
      .from(schema.personPages)
      .where(
        sql`${schema.personPages.statusCode} IS NULL OR ${schema.personPages.statusCode} >= 400`
      )
      .orderBy(desc(schema.personPages.fetchedAt));
  } catch {
    return [];
  }
}

export async function deletePersonItems(personSlug: string): Promise<void> {
  const db = resolveDb();
  if (!db) return;
  await db
    .delete(schema.personItems)
    .where(eq(schema.personItems.personSlug, personSlug));
}

export async function insertPersonItems(
  rows: Array<{ personSlug: string; item: string; tagsJson: string; detail: string | null; extractedAt: string }>,
): Promise<void> {
  const db = resolveDb();
  if (!db || rows.length === 0) return;

  for (const row of rows) {
    await db
      .insert(schema.personItems)
      .values(row)
      .onConflictDoUpdate({
        target: [schema.personItems.personSlug, schema.personItems.item],
        set: {
          tagsJson: row.tagsJson,
          detail: row.detail,
          extractedAt: row.extractedAt,
        },
      });
  }
}

export async function getScrapedContent(personSlug: string): Promise<{
  contentMarkdown: string | null;
  contentHash: string | null;
} | null> {
  const db = resolveDb();
  if (!db) return null;

  return db
    .select({
      contentMarkdown: schema.personPages.contentMarkdown,
      contentHash: schema.personPages.contentHash,
    })
    .from(schema.personPages)
    .where(eq(schema.personPages.personSlug, personSlug))
    .limit(1)
    .then((rows) => rows[0] ?? null);
}

export async function getAllUniqueItems(): Promise<Array<{
  item: string;
  count: number;
  tags: string[];
}>> {
  const db = resolveDb();
  if (!db) return [];

  try {
    const rows = await getAllExtractedRows();
    const itemToPeople = new Map<string, Set<string>>();
    const itemToTags = new Map<string, Set<string>>();

    for (const row of rows) {
      const item = row.item.trim();
      if (!item) continue;
      if (!itemToPeople.has(item)) itemToPeople.set(item, new Set());
      itemToPeople.get(item)!.add(row.person_slug);
      if (!itemToTags.has(item)) itemToTags.set(item, new Set());
      for (const tag of parseTagsJson(row.tags_json)) {
        itemToTags.get(item)!.add(tag.trim());
      }
    }

    return [...itemToPeople.entries()]
      .map(([item, people]) => ({
        item,
        count: people.size,
        tags: uniqueSorted(itemToTags.get(item) ?? []),
      }))
      .sort((a, b) => b.count - a.count);
  } catch {
    return [];
  }
}

export async function getItemEnrichment(itemSlug: string): Promise<{
  itemType: string | null;
  description: string | null;
  itemUrl: string | null;
  enrichedAt: string | null;
} | null> {
  const db = resolveDb();
  if (!db) return null;

  return db
    .select({
      itemType: schema.items.itemType,
      description: schema.items.description,
      itemUrl: schema.items.itemUrl,
      enrichedAt: schema.items.enrichedAt,
    })
    .from(schema.items)
    .where(eq(schema.items.itemSlug, itemSlug))
    .limit(1)
    .then((rows) => rows[0] ?? null);
}

export async function upsertItemEnrichment(
  itemSlug: string,
  itemName: string,
  data: { itemType?: string | null; description?: string | null; itemUrl?: string | null },
): Promise<void> {
  const db = resolveDb();
  if (!db) return;

  await db
    .insert(schema.items)
    .values({
      itemSlug,
      itemName,
      itemType: data.itemType ?? null,
      description: data.description ?? null,
      itemUrl: data.itemUrl ?? null,
      enrichedAt: new Date().toISOString(),
    })
    .onConflictDoUpdate({
      target: schema.items.itemSlug,
      set: {
        itemName,
        itemType: data.itemType ?? null,
        description: data.description ?? null,
        itemUrl: data.itemUrl ?? null,
        enrichedAt: new Date().toISOString(),
      },
    });
}

export async function getAllItemEnrichments(): Promise<Array<{
  itemSlug: string;
  itemName: string;
  itemType: string | null;
  description: string | null;
  itemUrl: string | null;
  enrichedAt: string | null;
}>> {
  const db = resolveDb();
  if (!db) return [];

  try {
    return await db
      .select()
      .from(schema.items);
  } catch {
    return [];
  }
}
