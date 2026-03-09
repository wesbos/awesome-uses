import { z } from 'zod';
import { and, eq, like, asc, sql } from 'drizzle-orm';
import * as schema from '../../server/schema';
import { defineTool } from '../registry';
import type { ToolDefinition } from '../types';
import { maybeArraySchema, nonEmptyStringSchema, optionalTrimmedStringSchema } from '../schemas';
import { NotFoundError } from '../errors';
import { parseTagsJson, uniqueSorted } from './utils';

const listPersonItemsInputSchema = z.object({
  personSlug: z.string().trim().optional(),
  q: z.string().trim().optional(),
  limit: z.number().int().positive().max(100).default(10),
  offset: z.number().int().min(0).default(0),
});

const getPersonItemInputSchema = z.object({
  personSlug: nonEmptyStringSchema,
  item: nonEmptyStringSchema,
});

const createPersonItemInputSchema = z.object({
  personSlug: nonEmptyStringSchema,
  item: nonEmptyStringSchema,
  tags: maybeArraySchema,
  detail: optionalTrimmedStringSchema.nullable().optional(),
  extractedAt: z.string().datetime().optional(),
});

const updatePersonItemInputSchema = z.object({
  personSlug: nonEmptyStringSchema,
  item: nonEmptyStringSchema,
  patch: z.object({
    tags: maybeArraySchema.optional(),
    detail: optionalTrimmedStringSchema.nullable().optional(),
    extractedAt: z.string().datetime().optional(),
    nextItemName: z.string().trim().min(1).optional(),
  }),
});

const deletePersonItemInputSchema = z.object({
  personSlug: nonEmptyStringSchema,
  item: nonEmptyStringSchema,
});

const deletePersonItemsInputSchema = z.object({
  personSlug: nonEmptyStringSchema,
});

function mapRow(row: typeof schema.personItems.$inferSelect) {
  return {
    id: row.id,
    personSlug: row.personSlug,
    item: row.item,
    tags: parseTagsJson(row.tagsJson),
    detail: row.detail,
    extractedAt: row.extractedAt,
  };
}

export const personItemTools: ToolDefinition[] = [
  defineTool({
    name: 'personItems.list',
    scope: 'personItems',
    description: 'List extracted person-item rows.',
    inputSchema: listPersonItemsInputSchema,
    handler: async ({ db }, input) => {
      const conditions = [];
      if (input.personSlug) {
        conditions.push(eq(schema.personItems.personSlug, input.personSlug));
      }
      if (input.q) {
        conditions.push(like(schema.personItems.item, `%${input.q}%`));
      }

      const where = conditions.length > 0 ? and(...conditions) : undefined;

      const total = (await db
        .select({ count: sql<number>`count(*)` })
        .from(schema.personItems)
        .where(where)
        .get())!.count;

      const rows = await db
        .select()
        .from(schema.personItems)
        .where(where)
        .orderBy(asc(schema.personItems.personSlug), asc(schema.personItems.item))
        .limit(input.limit)
        .offset(input.offset)
        .all();

      return {
        total,
        rows: rows.map(mapRow),
      };
    },
  }),
  defineTool({
    name: 'personItems.get',
    scope: 'personItems',
    description: 'Get one extracted person-item row.',
    inputSchema: getPersonItemInputSchema,
    handler: async ({ db }, input) => {
      const row = await db
        .select()
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
      return mapRow(row);
    },
  }),
  defineTool({
    name: 'personItems.create',
    scope: 'personItems',
    description: 'Create or upsert an extracted person-item row.',
    inputSchema: createPersonItemInputSchema,
    handler: async ({ db }, input) => {
      const extractedAt = input.extractedAt ?? new Date().toISOString();
      const tags = uniqueSorted(input.tags);

      await db.insert(schema.personItems)
        .values({
          personSlug: input.personSlug,
          item: input.item,
          tagsJson: JSON.stringify(tags),
          detail: input.detail ?? null,
          extractedAt,
        })
        .onConflictDoUpdate({
          target: [schema.personItems.personSlug, schema.personItems.item],
          set: {
            tagsJson: JSON.stringify(tags),
            detail: input.detail ?? null,
            extractedAt,
          },
        })
        .run();

      const row = await db
        .select()
        .from(schema.personItems)
        .where(and(
          eq(schema.personItems.personSlug, input.personSlug),
          eq(schema.personItems.item, input.item),
        ))
        .get();

      return row ? mapRow(row) : null;
    },
  }),
  defineTool({
    name: 'personItems.update',
    scope: 'personItems',
    description: 'Update an extracted person-item row.',
    inputSchema: updatePersonItemInputSchema,
    handler: async ({ db }, input) => {
      const existing = await db
        .select()
        .from(schema.personItems)
        .where(and(
          eq(schema.personItems.personSlug, input.personSlug),
          eq(schema.personItems.item, input.item),
        ))
        .get();

      if (!existing) {
        throw new NotFoundError(
          `Person item (${input.personSlug}, ${input.item}) was not found.`,
        );
      }

      const nextItemName = input.patch.nextItemName ?? existing.item;
      const nextTags = input.patch.tags
        ? uniqueSorted(input.patch.tags)
        : parseTagsJson(existing.tagsJson);
      const nextDetail =
        typeof input.patch.detail !== 'undefined' ? input.patch.detail : existing.detail;
      const nextExtractedAt = input.patch.extractedAt ?? existing.extractedAt;

      await db.update(schema.personItems)
        .set({
          item: nextItemName,
          tagsJson: JSON.stringify(nextTags),
          detail: nextDetail ?? null,
          extractedAt: nextExtractedAt,
        })
        .where(and(
          eq(schema.personItems.personSlug, input.personSlug),
          eq(schema.personItems.item, input.item),
        ))
        .run();

      const row = await db
        .select()
        .from(schema.personItems)
        .where(and(
          eq(schema.personItems.personSlug, input.personSlug),
          eq(schema.personItems.item, nextItemName),
        ))
        .get();

      return row ? mapRow(row) : null;
    },
  }),
  defineTool({
    name: 'personItems.delete',
    scope: 'personItems',
    description: 'Delete an extracted person-item row.',
    inputSchema: deletePersonItemInputSchema,
    handler: async ({ db }, input) => {
      const result = await db
        .delete(schema.personItems)
        .where(and(
          eq(schema.personItems.personSlug, input.personSlug),
          eq(schema.personItems.item, input.item),
        ))
        .run();

      return {
        deleted: result.changes,
      };
    },
  }),
  defineTool({
    name: 'personItems.deleteForPerson',
    scope: 'personItems',
    description: 'Delete all extracted items for one person.',
    inputSchema: deletePersonItemsInputSchema,
    handler: async ({ db }, input) => {
      const result = await db
        .delete(schema.personItems)
        .where(eq(schema.personItems.personSlug, input.personSlug))
        .run();

      return {
        personSlug: input.personSlug,
        deletedRows: result.changes,
      };
    },
  }),
];
