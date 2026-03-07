import { z } from 'zod';
import { defineTool } from '../registry';
import type { ToolDefinition } from '../types';
import { nonEmptyStringSchema } from '../schemas';
import { NotFoundError } from '../errors';
import { normalizeCategory, parseTagsJson, uniqueSorted } from './utils';

type CategoryRow = {
  category: string;
  itemCount: number;
  personCount: number;
};

const listCategoriesInputSchema = z.object({
  q: z.string().trim().optional(),
});

const getCategoryInputSchema = z.object({
  category: nonEmptyStringSchema,
});

const assignCategoryInputSchema = z.object({
  personSlug: nonEmptyStringSchema,
  item: nonEmptyStringSchema,
  category: nonEmptyStringSchema,
});

const renameCategoryInputSchema = z.object({
  fromCategory: nonEmptyStringSchema,
  toCategory: nonEmptyStringSchema,
});

const mergeCategoriesInputSchema = z.object({
  targetCategory: nonEmptyStringSchema,
  sourceCategories: z.array(nonEmptyStringSchema).min(1),
});

const deleteCategoryInputSchema = z.object({
  category: nonEmptyStringSchema,
  replacementCategory: z.string().trim().optional(),
});

function listCategoryRows(
  rows: Array<{ item: string; tags_json: string; person_slug: string }>,
): CategoryRow[] {
  const categoryToItems = new Map<string, Set<string>>();
  const categoryToPeople = new Map<string, Set<string>>();

  for (const row of rows) {
    for (const category of parseTagsJson(row.tags_json)) {
      const normalized = normalizeCategory(category);
      if (!normalized) continue;
      if (!categoryToItems.has(normalized)) categoryToItems.set(normalized, new Set());
      if (!categoryToPeople.has(normalized)) categoryToPeople.set(normalized, new Set());
      categoryToItems.get(normalized)!.add(row.item);
      categoryToPeople.get(normalized)!.add(row.person_slug);
    }
  }

  return [...categoryToItems.entries()]
    .map(([category, items]) => ({
      category,
      itemCount: items.size,
      personCount: categoryToPeople.get(category)?.size ?? 0,
    }))
    .sort((a, b) => {
      if (b.itemCount !== a.itemCount) return b.itemCount - a.itemCount;
      return a.category.localeCompare(b.category);
    });
}

export const categoryTools: ToolDefinition[] = [
  defineTool({
    name: 'categories.list',
    scope: 'categories',
    description: 'List extracted categories from person items.',
    inputSchema: listCategoriesInputSchema,
    handler: ({ siteDb }, input) => {
      const rows = siteDb.all<{ item: string; tags_json: string; person_slug: string }>(
        'SELECT item, tags_json, person_slug FROM person_items',
      );
      const all = listCategoryRows(rows);
      const filtered = input.q
        ? all.filter((row) => row.category.includes(input.q!.toLowerCase()))
        : all;
      return {
        total: filtered.length,
        rows: filtered,
      };
    },
  }),
  defineTool({
    name: 'categories.get',
    scope: 'categories',
    description: 'Get detail for one extracted category.',
    inputSchema: getCategoryInputSchema,
    handler: ({ siteDb }, input) => {
      const category = normalizeCategory(input.category);
      const rows = siteDb.all<{ person_slug: string; item: string; tags_json: string }>(
        'SELECT person_slug, item, tags_json FROM person_items',
      );
      const matches = rows.filter((row) =>
        parseTagsJson(row.tags_json).map(normalizeCategory).includes(category),
      );
      if (matches.length === 0) {
        throw new NotFoundError(`Category "${category}" was not found.`);
      }

      const people = uniqueSorted(matches.map((row) => row.person_slug));
      const items = uniqueSorted(matches.map((row) => row.item));

      return {
        category,
        peopleCount: people.length,
        itemCount: items.length,
        people,
        items,
      };
    },
  }),
  defineTool({
    name: 'categories.assignToPersonItem',
    scope: 'categories',
    description: 'Assign an extracted category to a person item row.',
    inputSchema: assignCategoryInputSchema,
    handler: ({ siteDb }, input) => {
      const category = normalizeCategory(input.category);
      const row = siteDb.get<{ tags_json: string }>(
        'SELECT tags_json FROM person_items WHERE person_slug = ? AND item = ?',
        [input.personSlug, input.item],
      );
      if (!row) {
        throw new NotFoundError(
          `Person item (${input.personSlug}, ${input.item}) was not found.`,
        );
      }

      const nextTags = uniqueSorted([...parseTagsJson(row.tags_json).map(normalizeCategory), category]);
      siteDb.run(
        'UPDATE person_items SET tags_json = ? WHERE person_slug = ? AND item = ?',
        [JSON.stringify(nextTags), input.personSlug, input.item],
      );
      return {
        personSlug: input.personSlug,
        item: input.item,
        tags: nextTags,
      };
    },
  }),
  defineTool({
    name: 'categories.rename',
    scope: 'categories',
    description: 'Rename one extracted category to another.',
    inputSchema: renameCategoryInputSchema,
    handler: ({ siteDb }, input) => {
      const fromCategory = normalizeCategory(input.fromCategory);
      const toCategory = normalizeCategory(input.toCategory);

      const rows = siteDb.all<{
        person_slug: string;
        item: string;
        tags_json: string;
      }>('SELECT person_slug, item, tags_json FROM person_items');

      let updatedRows = 0;
      for (const row of rows) {
        const tags = parseTagsJson(row.tags_json).map(normalizeCategory);
        if (!tags.includes(fromCategory)) continue;
        const nextTags = uniqueSorted(tags.map((tag) => (tag === fromCategory ? toCategory : tag)));
        siteDb.run(
          'UPDATE person_items SET tags_json = ? WHERE person_slug = ? AND item = ?',
          [JSON.stringify(nextTags), row.person_slug, row.item],
        );
        updatedRows += 1;
      }

      return {
        fromCategory,
        toCategory,
        updatedRows,
      };
    },
  }),
  defineTool({
    name: 'categories.merge',
    scope: 'categories',
    description: 'Merge many extracted categories into one target category.',
    inputSchema: mergeCategoriesInputSchema,
    handler: ({ siteDb }, input) => {
      const targetCategory = normalizeCategory(input.targetCategory);
      const sourceSet = new Set(input.sourceCategories.map(normalizeCategory));
      sourceSet.delete(targetCategory);

      const rows = siteDb.all<{
        person_slug: string;
        item: string;
        tags_json: string;
      }>('SELECT person_slug, item, tags_json FROM person_items');

      let updatedRows = 0;
      let mergedRefs = 0;
      for (const row of rows) {
        const tags = parseTagsJson(row.tags_json).map(normalizeCategory);
        if (!tags.some((tag) => sourceSet.has(tag))) continue;
        const nextTags = uniqueSorted(
          tags.map((tag) => {
            if (!sourceSet.has(tag)) return tag;
            mergedRefs += 1;
            return targetCategory;
          }),
        );
        siteDb.run(
          'UPDATE person_items SET tags_json = ? WHERE person_slug = ? AND item = ?',
          [JSON.stringify(nextTags), row.person_slug, row.item],
        );
        updatedRows += 1;
      }

      return {
        targetCategory,
        sourceCategories: [...sourceSet],
        updatedRows,
        mergedRefs,
      };
    },
  }),
  defineTool({
    name: 'categories.deleteOrReplace',
    scope: 'categories',
    description: 'Delete an extracted category, optionally replacing it.',
    inputSchema: deleteCategoryInputSchema,
    handler: ({ siteDb }, input) => {
      const category = normalizeCategory(input.category);
      const replacement = input.replacementCategory
        ? normalizeCategory(input.replacementCategory)
        : null;

      const rows = siteDb.all<{
        person_slug: string;
        item: string;
        tags_json: string;
      }>('SELECT person_slug, item, tags_json FROM person_items');

      let updatedRows = 0;
      let removedRefs = 0;
      for (const row of rows) {
        const tags = parseTagsJson(row.tags_json).map(normalizeCategory);
        if (!tags.includes(category)) continue;
        const nextTags = uniqueSorted(
          tags.flatMap((tag) => {
            if (tag !== category) return [tag];
            removedRefs += 1;
            return replacement ? [replacement] : [];
          }),
        );
        siteDb.run(
          'UPDATE person_items SET tags_json = ? WHERE person_slug = ? AND item = ?',
          [JSON.stringify(nextTags), row.person_slug, row.item],
        );
        updatedRows += 1;
      }

      return {
        category,
        replacementCategory: replacement,
        updatedRows,
        removedRefs,
      };
    },
  }),
];
