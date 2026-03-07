import { z } from 'zod';
import { defineTool } from '../registry';
import type { ToolDefinition } from '../types';
import { maybeArraySchema, nonEmptyStringSchema, optionalTrimmedStringSchema } from '../schemas';
import { NotFoundError } from '../errors';
import { parseTagsJson, uniqueSorted } from './utils';

const listPersonItemsInputSchema = z.object({
  personSlug: z.string().trim().optional(),
  q: z.string().trim().optional(),
  limit: z.number().int().positive().max(1000).default(200),
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

type PersonItemRow = {
  id: number;
  person_slug: string;
  item: string;
  tags_json: string;
  detail: string | null;
  extracted_at: string;
};

function mapRow(row: PersonItemRow) {
  return {
    id: row.id,
    personSlug: row.person_slug,
    item: row.item,
    tags: parseTagsJson(row.tags_json),
    detail: row.detail,
    extractedAt: row.extracted_at,
  };
}

export const personItemTools: ToolDefinition[] = [
  defineTool({
    name: 'personItems.list',
    scope: 'personItems',
    description: 'List extracted person-item rows.',
    inputSchema: listPersonItemsInputSchema,
    handler: ({ siteDb }, input) => {
      const rows = siteDb.all<PersonItemRow>(
        'SELECT id, person_slug, item, tags_json, detail, extracted_at FROM person_items ORDER BY person_slug, item',
      );
      const filtered = rows.filter((row) => {
        if (input.personSlug && row.person_slug !== input.personSlug) return false;
        if (input.q) {
          const haystack = `${row.person_slug} ${row.item} ${row.tags_json} ${row.detail ?? ''}`.toLowerCase();
          if (!haystack.includes(input.q.toLowerCase())) return false;
        }
        return true;
      });
      const paged = filtered.slice(input.offset, input.offset + input.limit);
      return {
        total: filtered.length,
        rows: paged.map(mapRow),
      };
    },
  }),
  defineTool({
    name: 'personItems.get',
    scope: 'personItems',
    description: 'Get one extracted person-item row.',
    inputSchema: getPersonItemInputSchema,
    handler: ({ siteDb }, input) => {
      const row = siteDb.get<PersonItemRow>(
        'SELECT id, person_slug, item, tags_json, detail, extracted_at FROM person_items WHERE person_slug = ? AND item = ?',
        [input.personSlug, input.item],
      );
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
    handler: ({ siteDb }, input) => {
      const extractedAt = input.extractedAt ?? new Date().toISOString();
      const tags = uniqueSorted(input.tags);
      siteDb.run(
        `INSERT INTO person_items (person_slug, item, tags_json, detail, extracted_at)
         VALUES (?, ?, ?, ?, ?)
         ON CONFLICT(person_slug, item) DO UPDATE SET
           tags_json=excluded.tags_json,
           detail=excluded.detail,
           extracted_at=excluded.extracted_at`,
        [
          input.personSlug,
          input.item,
          JSON.stringify(tags),
          input.detail ?? null,
          extractedAt,
        ],
      );

      const row = siteDb.get<PersonItemRow>(
        'SELECT id, person_slug, item, tags_json, detail, extracted_at FROM person_items WHERE person_slug = ? AND item = ?',
        [input.personSlug, input.item],
      );
      return row ? mapRow(row) : null;
    },
  }),
  defineTool({
    name: 'personItems.update',
    scope: 'personItems',
    description: 'Update an extracted person-item row.',
    inputSchema: updatePersonItemInputSchema,
    handler: ({ siteDb }, input) => {
      const existing = siteDb.get<PersonItemRow>(
        'SELECT id, person_slug, item, tags_json, detail, extracted_at FROM person_items WHERE person_slug = ? AND item = ?',
        [input.personSlug, input.item],
      );
      if (!existing) {
        throw new NotFoundError(
          `Person item (${input.personSlug}, ${input.item}) was not found.`,
        );
      }

      const nextItemName = input.patch.nextItemName ?? existing.item;
      const nextTags = input.patch.tags
        ? uniqueSorted(input.patch.tags)
        : parseTagsJson(existing.tags_json);
      const nextDetail =
        typeof input.patch.detail !== 'undefined' ? input.patch.detail : existing.detail;
      const nextExtractedAt = input.patch.extractedAt ?? existing.extracted_at;

      siteDb.run(
        `UPDATE person_items
         SET item = ?, tags_json = ?, detail = ?, extracted_at = ?
         WHERE person_slug = ? AND item = ?`,
        [
          nextItemName,
          JSON.stringify(nextTags),
          nextDetail ?? null,
          nextExtractedAt,
          input.personSlug,
          input.item,
        ],
      );

      const row = siteDb.get<PersonItemRow>(
        'SELECT id, person_slug, item, tags_json, detail, extracted_at FROM person_items WHERE person_slug = ? AND item = ?',
        [input.personSlug, nextItemName],
      );
      return row ? mapRow(row) : null;
    },
  }),
  defineTool({
    name: 'personItems.delete',
    scope: 'personItems',
    description: 'Delete an extracted person-item row.',
    inputSchema: deletePersonItemInputSchema,
    handler: ({ siteDb }, input) => {
      const result = siteDb.run(
        'DELETE FROM person_items WHERE person_slug = ? AND item = ?',
        [input.personSlug, input.item],
      );
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
    handler: ({ siteDb }, input) => {
      const result = siteDb.run('DELETE FROM person_items WHERE person_slug = ?', [input.personSlug]);
      return {
        personSlug: input.personSlug,
        deletedRows: result.changes,
      };
    },
  }),
];
