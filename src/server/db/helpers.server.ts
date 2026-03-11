import { asc } from 'drizzle-orm';
import * as schema from '../schema';
import { buildUniqueSlug, slugify } from '../../lib/slug';
import { resolveDb } from './connection.server';

export function parseTagsJson(input: string): string[] {
  try {
    const parsed = JSON.parse(input);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((value): value is string => typeof value === 'string');
  } catch {
    return [];
  }
}

export function uniqueSorted(values: Iterable<string>): string[] {
  return Array.from(new Set(values)).sort((a, b) => a.localeCompare(b));
}

export type AllItemRow = {
  item: string;
  tags_json: string;
  person_slug: string;
};

export type ExtractedIndexes = {
  tagToItems: Map<string, Map<string, Set<string>>>;
  tagToPeople: Map<string, Set<string>>;
  itemToPeople: Map<string, Set<string>>;
  itemToTags: Map<string, Set<string>>;
  tagToSlug: Map<string, string>;
  slugToTag: Map<string, string>;
  itemToSlug: Map<string, string>;
  slugToItem: Map<string, string>;
};

export function buildExtractedIndexes(rows: AllItemRow[]): ExtractedIndexes {
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
      const normalizedTag = tag.trim().toLowerCase();
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

export async function getAllExtractedRows(): Promise<AllItemRow[]> {
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
