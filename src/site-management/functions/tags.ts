import { z } from 'zod';
import { and, eq, asc } from 'drizzle-orm';
import * as schema from '../../server/schema';
import { defineTool } from '../registry';
import type { ToolDefinition } from '../types';
import { nonEmptyStringSchema } from '../schemas';
import { NotFoundError } from '../errors';
import { normalizeTag, parseTagsJson, uniqueSorted } from './utils';
import type { SiteDb } from '../stores/site-db';

type TagRow = {
  tag: string;
  itemCount: number;
  personCount: number;
};

const listTagsInputSchema = z.object({
  q: z.string().trim().optional(),
});

const getTagInputSchema = z.object({
  tag: nonEmptyStringSchema,
});

const assignTagInputSchema = z.object({
  personSlug: nonEmptyStringSchema,
  item: nonEmptyStringSchema,
  tag: nonEmptyStringSchema,
});

const renameTagInputSchema = z.object({
  fromTag: nonEmptyStringSchema,
  toTag: nonEmptyStringSchema,
});

const mergeTagsInputSchema = z.object({
  targetTag: nonEmptyStringSchema,
  sourceTags: z.array(nonEmptyStringSchema).min(1),
});

const deleteTagInputSchema = z.object({
  tag: nonEmptyStringSchema,
  replacementTag: z.string().trim().optional(),
});

async function queryAllPersonItems(db: SiteDb) {
  return await db
    .select({
      personSlug: schema.personItems.personSlug,
      item: schema.personItems.item,
      tagsJson: schema.personItems.tagsJson,
    })
    .from(schema.personItems)
    .orderBy(asc(schema.personItems.item))
    .all();
}

function listTagRows(
  rows: Array<{ item: string; tagsJson: string; personSlug: string }>,
): TagRow[] {
  const tagToItems = new Map<string, Set<string>>();
  const tagToPeople = new Map<string, Set<string>>();

  for (const row of rows) {
    for (const tag of parseTagsJson(row.tagsJson)) {
      const normalized = normalizeTag(tag);
      if (!normalized) continue;
      if (!tagToItems.has(normalized)) tagToItems.set(normalized, new Set());
      if (!tagToPeople.has(normalized)) tagToPeople.set(normalized, new Set());
      tagToItems.get(normalized)!.add(row.item);
      tagToPeople.get(normalized)!.add(row.personSlug);
    }
  }

  return [...tagToItems.entries()]
    .map(([tag, tagItems]) => ({
      tag,
      itemCount: tagItems.size,
      personCount: tagToPeople.get(tag)?.size ?? 0,
    }))
    .sort((a, b) => {
      if (b.itemCount !== a.itemCount) return b.itemCount - a.itemCount;
      return a.tag.localeCompare(b.tag);
    });
}

export const tagTools: ToolDefinition[] = [
  defineTool({
    name: 'tags.list',
    scope: 'tags',
    description: 'List extracted tags from person items.',
    inputSchema: listTagsInputSchema,
    handler: async ({ db }, input) => {
      const rows = await queryAllPersonItems(db);
      const all = listTagRows(rows);
      const filtered = input.q
        ? all.filter((row) => row.tag.includes(input.q!.toLowerCase()))
        : all;
      return {
        total: filtered.length,
        rows: filtered,
      };
    },
  }),
  defineTool({
    name: 'tags.get',
    scope: 'tags',
    description: 'Get detail for one extracted tag.',
    inputSchema: getTagInputSchema,
    handler: async ({ db }, input) => {
      const tag = normalizeTag(input.tag);
      const rows = await queryAllPersonItems(db);
      const matches = rows.filter((row) =>
        parseTagsJson(row.tagsJson).map(normalizeTag).includes(tag),
      );
      if (matches.length === 0) {
        throw new NotFoundError(`Tag "${tag}" was not found.`);
      }

      const people = uniqueSorted(matches.map((row) => row.personSlug));
      const matchedItems = uniqueSorted(matches.map((row) => row.item));

      return {
        tag,
        peopleCount: people.length,
        itemCount: matchedItems.length,
        people,
        items: matchedItems,
      };
    },
  }),
  defineTool({
    name: 'tags.assignToPersonItem',
    scope: 'tags',
    description: 'Assign an extracted tag to a person item row.',
    inputSchema: assignTagInputSchema,
    handler: async ({ db }, input) => {
      const tag = normalizeTag(input.tag);
      const row = await db
        .select({ tagsJson: schema.personItems.tagsJson })
        .from(schema.personItems)
        .where(and(
          eq(schema.personItems.personSlug, input.personSlug),
          eq(schema.personItems.item, input.item),
        ))
        .get();

      if (!row) {
        throw new NotFoundError(
          `Person item (${input.personSlug}, ${input.item}) was not found.`,
        );
      }

      const nextTags = uniqueSorted([...parseTagsJson(row.tagsJson).map(normalizeTag), tag]);
      await db.update(schema.personItems)
        .set({ tagsJson: JSON.stringify(nextTags) })
        .where(and(
          eq(schema.personItems.personSlug, input.personSlug),
          eq(schema.personItems.item, input.item),
        ))
        .run();

      return {
        personSlug: input.personSlug,
        item: input.item,
        tags: nextTags,
      };
    },
  }),
  defineTool({
    name: 'tags.rename',
    scope: 'tags',
    description: 'Rename one extracted tag to another.',
    inputSchema: renameTagInputSchema,
    handler: async ({ db }, input) => {
      const fromTag = normalizeTag(input.fromTag);
      const toTag = normalizeTag(input.toTag);
      const rows = await queryAllPersonItems(db);

      let updatedRows = 0;
      for (const row of rows) {
        const tags = parseTagsJson(row.tagsJson).map(normalizeTag);
        if (!tags.includes(fromTag)) continue;
        const nextTags = uniqueSorted(tags.map((tag) => (tag === fromTag ? toTag : tag)));
        await db.update(schema.personItems)
          .set({ tagsJson: JSON.stringify(nextTags) })
          .where(and(
            eq(schema.personItems.personSlug, row.personSlug),
            eq(schema.personItems.item, row.item),
          ))
          .run();
        updatedRows += 1;
      }

      return {
        fromTag,
        toTag,
        updatedRows,
      };
    },
  }),
  defineTool({
    name: 'tags.merge',
    scope: 'tags',
    description: 'Merge many extracted tags into one target tag.',
    inputSchema: mergeTagsInputSchema,
    handler: async ({ db }, input) => {
      const targetTag = normalizeTag(input.targetTag);
      const sourceSet = new Set(input.sourceTags.map(normalizeTag));
      sourceSet.delete(targetTag);

      const rows = await queryAllPersonItems(db);

      let updatedRows = 0;
      let mergedRefs = 0;
      for (const row of rows) {
        const tags = parseTagsJson(row.tagsJson).map(normalizeTag);
        if (!tags.some((tag) => sourceSet.has(tag))) continue;
        const nextTags = uniqueSorted(
          tags.map((tag) => {
            if (!sourceSet.has(tag)) return tag;
            mergedRefs += 1;
            return targetTag;
          }),
        );
        await db.update(schema.personItems)
          .set({ tagsJson: JSON.stringify(nextTags) })
          .where(and(
            eq(schema.personItems.personSlug, row.personSlug),
            eq(schema.personItems.item, row.item),
          ))
          .run();
        updatedRows += 1;
      }

      return {
        targetTag,
        sourceTags: [...sourceSet],
        updatedRows,
        mergedRefs,
      };
    },
  }),
  defineTool({
    name: 'tags.deleteOrReplace',
    scope: 'tags',
    description: 'Delete an extracted tag, optionally replacing it.',
    inputSchema: deleteTagInputSchema,
    handler: async ({ db }, input) => {
      const tag = normalizeTag(input.tag);
      const replacement = input.replacementTag
        ? normalizeTag(input.replacementTag)
        : null;

      const rows = await queryAllPersonItems(db);

      let updatedRows = 0;
      let removedRefs = 0;
      for (const row of rows) {
        const tags = parseTagsJson(row.tagsJson).map(normalizeTag);
        if (!tags.includes(tag)) continue;
        const nextTags = uniqueSorted(
          tags.flatMap((t) => {
            if (t !== tag) return [t];
            removedRefs += 1;
            return replacement ? [replacement] : [];
          }),
        );
        await db.update(schema.personItems)
          .set({ tagsJson: JSON.stringify(nextTags) })
          .where(and(
            eq(schema.personItems.personSlug, row.personSlug),
            eq(schema.personItems.item, row.item),
          ))
          .run();
        updatedRows += 1;
      }

      return {
        tag,
        replacementTag: replacement,
        updatedRows,
        removedRefs,
      };
    },
  }),
];
