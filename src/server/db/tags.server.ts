import { like, and, eq, sql } from 'drizzle-orm';
import { slugify } from '../../lib/slug';
import * as schema from '../schema';
import { resolveDb } from './connection.server';
import {
  getAllExtractedRows,
  buildExtractedIndexes,
  uniqueSorted,
  parseTagsJson,
  type AllItemRow,
} from './helpers.server';

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
