import { eq, like, and, sql, asc, inArray } from 'drizzle-orm';
import type { PersonItem } from '../../lib/types';
import { buildUniqueSlug, slugify } from '../../lib/slug';
import * as schema from '../schema';
import { resolveDb } from './connection.server';
import {
  getAllExtractedRows,
  buildExtractedIndexes,
  uniqueSorted,
  parseTagsJson,
} from './helpers.server';

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

export async function getItemsByPerson(): Promise<Map<string, string[]>> {
  const rows = await getAllExtractedRows();
  const map = new Map<string, string[]>();
  for (const row of rows) {
    const item = row.item.trim();
    if (!item) continue;
    if (!map.has(row.person_slug)) map.set(row.person_slug, []);
    map.get(row.person_slug)!.push(item);
  }
  return map;
}

export type DuplicateGroup = {
  canonical: string;
  canonicalCount: number;
  variants: Array<{ item: string; count: number }>;
};

export async function findDuplicateItems(): Promise<DuplicateGroup[]> {
  const rows = await getAllExtractedRows();

  const itemCounts = new Map<string, number>();
  for (const row of rows) {
    const item = row.item.trim();
    if (!item) continue;
    itemCounts.set(item, (itemCounts.get(item) || 0) + 1);
  }

  const lowerToVariants = new Map<string, Map<string, number>>();
  for (const [item, count] of itemCounts) {
    const key = item.toLowerCase().replace(/\s+/g, ' ').trim();
    if (!lowerToVariants.has(key)) lowerToVariants.set(key, new Map());
    lowerToVariants.get(key)!.set(item, count);
  }

  const groups: DuplicateGroup[] = [];
  for (const variants of lowerToVariants.values()) {
    if (variants.size < 2) continue;

    const sorted = [...variants.entries()].sort((a, b) => b[1] - a[1]);
    const [canonical, canonicalCount] = sorted[0];

    groups.push({
      canonical,
      canonicalCount,
      variants: sorted.slice(1).map(([item, count]) => ({ item, count })),
    });
  }

  return groups.sort((a, b) => {
    const totalA = a.canonicalCount + a.variants.reduce((s, v) => s + v.count, 0);
    const totalB = b.canonicalCount + b.variants.reduce((s, v) => s + v.count, 0);
    return totalB - totalA;
  });
}

export type ExtractionReviewData = {
  totalRows: number;
  totalTags: number;
  tags: Array<{
    tag: string;
    uniqueItems: number;
    totalPeople: number;
    topItems: Array<{ item: string; count: number }>;
  }>;
  multiTagItems: Array<{ item: string; tags: string[] }>;
  tinyTags: Array<{ tag: string; items: string[] }>;
  bannedLeaks: Array<{ tag: string; uniqueItems: number }>;
};

export async function getExtractionReviewData(
  bannedTags: string[],
): Promise<ExtractionReviewData> {
  const rows = await getAllExtractedRows();

  if (rows.length === 0) {
    return { totalRows: 0, totalTags: 0, tags: [], multiTagItems: [], tinyTags: [], bannedLeaks: [] };
  }

  const tagItems = new Map<string, Map<string, Set<string>>>();
  const itemTags = new Map<string, Set<string>>();

  for (const row of rows) {
    const item = row.item.trim();
    if (!item) continue;

    let tags: string[];
    try {
      tags = JSON.parse(row.tags_json);
    } catch {
      tags = ['unknown'];
    }

    for (const cat of tags) {
      if (!tagItems.has(cat)) tagItems.set(cat, new Map());
      const items = tagItems.get(cat)!;
      if (!items.has(item)) items.set(item, new Set());
      items.get(item)!.add(row.person_slug);

      if (!itemTags.has(item)) itemTags.set(item, new Set());
      itemTags.get(item)!.add(cat);
    }
  }

  const sortedTags = [...tagItems.entries()]
    .map(([cat, items]) => {
      const totalPeople = new Set([...items.values()].flatMap((v) => [...v])).size;
      const topItems = [...items.entries()]
        .sort((a, b) => b[1].size - a[1].size)
        .slice(0, 15)
        .map(([item, people]) => ({ item, count: people.size }));
      return { tag: cat, uniqueItems: items.size, totalPeople, topItems };
    })
    .sort((a, b) => b.uniqueItems - a.uniqueItems);

  const multiTagItems = [...itemTags.entries()]
    .filter(([, cats]) => cats.size > 2)
    .sort((a, b) => b[1].size - a[1].size)
    .slice(0, 30)
    .map(([item, cats]) => ({ item, tags: [...cats].sort() }));

  const bannedSet = new Set(bannedTags.map((b) => b.toLowerCase()));
  const tinyTags = sortedTags
    .filter((c) => c.uniqueItems <= 2)
    .map((c) => ({
      tag: c.tag,
      items: [...tagItems.get(c.tag)!.keys()],
    }));

  const bannedLeaks = sortedTags
    .filter((c) => bannedSet.has(c.tag.toLowerCase()))
    .map((c) => ({ tag: c.tag, uniqueItems: c.uniqueItems }));

  return {
    totalRows: rows.length,
    totalTags: sortedTags.length,
    tags: sortedTags,
    multiTagItems,
    tinyTags,
    bannedLeaks,
  };
}
