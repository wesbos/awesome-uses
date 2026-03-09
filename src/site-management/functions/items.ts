import { z } from 'zod';
import { zodResponseFormat } from 'openai/helpers/zod';
import { slugify } from '../../lib/slug';
import { defineTool } from '../registry';
import type { ToolDefinition } from '../types';
import { maybeArraySchema, nonEmptyStringSchema, optionalTrimmedStringSchema } from '../schemas';
import { NotFoundError } from '../errors';
import { parseTagsJson, uniqueSorted } from './utils';
import { createOpenAIClient } from '../../server/extract';

type ItemTableRow = {
  item_slug: string;
  item_name: string;
  item_type: string | null;
  description: string | null;
  item_url: string | null;
  enriched_at: string | null;
};

type PersonItemRow = {
  person_slug: string;
  item: string;
  tags_json: string;
  detail: string | null;
  extracted_at: string;
};

const listItemsInputSchema = z.object({
  q: z.string().trim().optional(),
  itemType: z.string().trim().optional(),
  limit: z.number().int().positive().max(1000).default(250),
  offset: z.number().int().min(0).default(0),
});

const getItemInputSchema = z.object({
  itemSlug: nonEmptyStringSchema,
});

const createOrUpsertItemInputSchema = z.object({
  itemName: nonEmptyStringSchema,
  itemSlug: optionalTrimmedStringSchema,
  itemType: optionalTrimmedStringSchema.nullable().optional(),
  description: optionalTrimmedStringSchema.nullable().optional(),
  itemUrl: optionalTrimmedStringSchema.nullable().optional(),
});

const updateItemInputSchema = z.object({
  itemSlug: nonEmptyStringSchema,
  patch: z.object({
    itemName: optionalTrimmedStringSchema,
    itemType: optionalTrimmedStringSchema.nullable().optional(),
    description: optionalTrimmedStringSchema.nullable().optional(),
    itemUrl: optionalTrimmedStringSchema.nullable().optional(),
  }),
});

const deleteItemInputSchema = z.object({
  itemSlug: nonEmptyStringSchema,
});

const findDuplicatesInputSchema = z.object({
  minVariants: z.number().int().min(2).max(25).default(2),
});

const mergeItemsInputSchema = z.object({
  canonicalItem: nonEmptyStringSchema,
  sourceItems: z.array(nonEmptyStringSchema).min(1),
});

const enrichItemsInputSchema = z.object({
  items: z
    .array(
      z.object({
        item: nonEmptyStringSchema,
        tags: z.array(nonEmptyStringSchema).default([]),
      }),
    )
    .min(1),
});

const EnrichedItemSchema = z.object({
  item: z.string(),
  itemType: z.enum(['product', 'service', 'software', 'other']),
  description: z
    .string()
    .describe('A short 1-sentence description of what this item is'),
  itemUrl: z
    .string()
    .nullable()
    .describe('The canonical URL where this item can be found. Use null if unsure.'),
});

const EnrichmentResultSchema = z.object({
  items: z.array(EnrichedItemSchema),
});

function mapItemRow(row: ItemTableRow) {
  return {
    itemSlug: row.item_slug,
    itemName: row.item_name,
    itemType: row.item_type,
    description: row.description,
    itemUrl: row.item_url,
    enrichedAt: row.enriched_at,
  };
}

function maxIsoDate(values: string[]): string {
  return values.sort((a, b) => b.localeCompare(a))[0] || new Date().toISOString();
}

function collectUniqueItems(rows: PersonItemRow[]) {
  const itemToPeople = new Map<string, Set<string>>();
  const itemToTags = new Map<string, Set<string>>();

  for (const row of rows) {
    const item = row.item.trim();
    if (!item) continue;
    if (!itemToPeople.has(item)) itemToPeople.set(item, new Set());
    if (!itemToTags.has(item)) itemToTags.set(item, new Set());
    itemToPeople.get(item)!.add(row.person_slug);
    for (const tag of parseTagsJson(row.tags_json)) {
      itemToTags.get(item)!.add(tag);
    }
  }

  return [...itemToPeople.entries()]
    .map(([item, people]) => ({
      item,
      itemSlug: slugify(item) || 'item',
      count: people.size,
      tags: uniqueSorted(itemToTags.get(item) ?? []),
      people: uniqueSorted(people),
    }))
    .sort((a, b) => {
      if (b.count !== a.count) return b.count - a.count;
      return a.item.localeCompare(b.item);
    });
}

export const itemTools: ToolDefinition[] = [
  defineTool({
    name: 'items.list',
    scope: 'items',
    description: 'List canonical items with enrichment + usage counts.',
    inputSchema: listItemsInputSchema,
    handler: ({ siteDb }, input) => {
      const enrichments = siteDb.all<ItemTableRow>(
        'SELECT item_slug, item_name, item_type, description, item_url, enriched_at FROM items',
      );
      const personItems = siteDb.all<PersonItemRow>(
        'SELECT person_slug, item, tags_json, detail, extracted_at FROM person_items',
      );

      const uniqueItems = collectUniqueItems(personItems);
      const enrichmentMap = new Map(enrichments.map((row) => [row.item_slug, row]));

      const rows = uniqueItems.map((entry) => {
        const enrichment = enrichmentMap.get(entry.itemSlug);
        return {
          item: entry.item,
          itemSlug: entry.itemSlug,
          count: entry.count,
          tags: entry.tags,
          people: entry.people,
          itemType: enrichment?.item_type ?? null,
          description: enrichment?.description ?? null,
          itemUrl: enrichment?.item_url ?? null,
          enrichedAt: enrichment?.enriched_at ?? null,
        };
      });

      const filtered = rows.filter((row) => {
        if (input.q) {
          const haystack =
            `${row.item} ${row.tags.join(' ')} ${row.description ?? ''} ${row.itemUrl ?? ''}`.toLowerCase();
          if (!haystack.includes(input.q.toLowerCase())) return false;
        }
        if (input.itemType && row.itemType !== input.itemType) return false;
        return true;
      });

      return {
        total: filtered.length,
        rows: filtered.slice(input.offset, input.offset + input.limit),
      };
    },
  }),
  defineTool({
    name: 'items.get',
    scope: 'items',
    description: 'Get one canonical item by slug.',
    inputSchema: getItemInputSchema,
    handler: ({ siteDb }, input) => {
      const row = siteDb.get<ItemTableRow>(
        'SELECT item_slug, item_name, item_type, description, item_url, enriched_at FROM items WHERE item_slug = ?',
        [input.itemSlug],
      );
      const personItems = siteDb.all<PersonItemRow>(
        'SELECT person_slug, item, tags_json, detail, extracted_at FROM person_items WHERE lower(item) = lower(?)',
        [input.itemSlug.replaceAll('-', ' ')],
      );

      const bySlugRows = siteDb.all<PersonItemRow>(
        'SELECT person_slug, item, tags_json, detail, extracted_at FROM person_items',
      ).filter((entry) => (slugify(entry.item) || 'item') === input.itemSlug);

      const matched = bySlugRows.length > 0 ? bySlugRows : personItems;
      if (!row && matched.length === 0) {
        throw new NotFoundError(`Item "${input.itemSlug}" was not found.`);
      }

      const itemName = row?.item_name ?? matched[0]?.item ?? input.itemSlug;
      const tags = uniqueSorted(matched.flatMap((entry) => parseTagsJson(entry.tags_json)));
      const people = uniqueSorted(matched.map((entry) => entry.person_slug));
      return {
        itemSlug: input.itemSlug,
        itemName,
        itemType: row?.item_type ?? null,
        description: row?.description ?? null,
        itemUrl: row?.item_url ?? null,
        enrichedAt: row?.enriched_at ?? null,
        tags,
        people,
        usageCount: people.length,
      };
    },
  }),
  defineTool({
    name: 'items.createOrUpsert',
    scope: 'items',
    description: 'Create or upsert canonical item enrichment data.',
    inputSchema: createOrUpsertItemInputSchema,
    handler: ({ siteDb }, input) => {
      const itemSlug = input.itemSlug ?? slugify(input.itemName) ?? 'item';
      const enrichedAt = new Date().toISOString();
      siteDb.run(
        `INSERT INTO items (item_slug, item_name, item_type, description, item_url, enriched_at)
         VALUES (?, ?, ?, ?, ?, ?)
         ON CONFLICT(item_slug) DO UPDATE SET
           item_name=excluded.item_name,
           item_type=excluded.item_type,
           description=excluded.description,
           item_url=excluded.item_url,
           enriched_at=excluded.enriched_at`,
        [
          itemSlug,
          input.itemName,
          input.itemType ?? null,
          input.description ?? null,
          input.itemUrl ?? null,
          enrichedAt,
        ],
      );
      const row = siteDb.get<ItemTableRow>(
        'SELECT item_slug, item_name, item_type, description, item_url, enriched_at FROM items WHERE item_slug = ?',
        [itemSlug],
      );
      return row ? mapItemRow(row) : null;
    },
  }),
  defineTool({
    name: 'items.update',
    scope: 'items',
    description: 'Update canonical item enrichment row.',
    inputSchema: updateItemInputSchema,
    handler: ({ siteDb }, input) => {
      const existing = siteDb.get<ItemTableRow>(
        'SELECT item_slug, item_name, item_type, description, item_url, enriched_at FROM items WHERE item_slug = ?',
        [input.itemSlug],
      );
      if (!existing) {
        throw new NotFoundError(`Item "${input.itemSlug}" was not found.`);
      }

      const next = {
        itemName: input.patch.itemName ?? existing.item_name,
        itemType:
          typeof input.patch.itemType !== 'undefined'
            ? input.patch.itemType
            : existing.item_type,
        description:
          typeof input.patch.description !== 'undefined'
            ? input.patch.description
            : existing.description,
        itemUrl:
          typeof input.patch.itemUrl !== 'undefined'
            ? input.patch.itemUrl
            : existing.item_url,
      };

      siteDb.run(
        `UPDATE items
         SET item_name = ?, item_type = ?, description = ?, item_url = ?, enriched_at = ?
         WHERE item_slug = ?`,
        [
          next.itemName,
          next.itemType ?? null,
          next.description ?? null,
          next.itemUrl ?? null,
          new Date().toISOString(),
          input.itemSlug,
        ],
      );

      const row = siteDb.get<ItemTableRow>(
        'SELECT item_slug, item_name, item_type, description, item_url, enriched_at FROM items WHERE item_slug = ?',
        [input.itemSlug],
      );
      return row ? mapItemRow(row) : null;
    },
  }),
  defineTool({
    name: 'items.delete',
    scope: 'items',
    description: 'Delete canonical item enrichment row.',
    inputSchema: deleteItemInputSchema,
    handler: ({ siteDb }, input) => {
      const result = siteDb.run('DELETE FROM items WHERE item_slug = ?', [input.itemSlug]);
      return {
        deleted: result.changes,
      };
    },
  }),
  defineTool({
    name: 'items.findDuplicates',
    scope: 'items',
    description: 'Detect duplicate item names in extracted person_items.',
    inputSchema: findDuplicatesInputSchema,
    handler: ({ siteDb }, input) => {
      const rows = siteDb.all<PersonItemRow>(
        'SELECT person_slug, item, tags_json, detail, extracted_at FROM person_items',
      );
      const itemCounts = new Map<string, number>();
      for (const row of rows) {
        const item = row.item.trim();
        if (!item) continue;
        itemCounts.set(item, (itemCounts.get(item) || 0) + 1);
      }

      const groups = new Map<string, Array<{ item: string; count: number }>>();
      for (const [item, count] of itemCounts) {
        const key = item.toLowerCase().replace(/\s+/g, ' ').trim();
        if (!groups.has(key)) groups.set(key, []);
        groups.get(key)!.push({ item, count });
      }

      const duplicates = [...groups.values()]
        .filter((variants) => variants.length >= input.minVariants)
        .map((variants) => {
          const sorted = variants.sort((a, b) => b.count - a.count);
          const [canonical, ...rest] = sorted;
          return {
            canonical: canonical.item,
            canonicalCount: canonical.count,
            variants: rest,
          };
        })
        .sort((a, b) => {
          const aTotal = a.canonicalCount + a.variants.reduce((sum, row) => sum + row.count, 0);
          const bTotal = b.canonicalCount + b.variants.reduce((sum, row) => sum + row.count, 0);
          return bTotal - aTotal;
        });

      return {
        totalGroups: duplicates.length,
        rows: duplicates,
      };
    },
  }),
  defineTool({
    name: 'items.merge',
    scope: 'items',
    description: 'Merge source extracted items into a canonical item.',
    inputSchema: mergeItemsInputSchema,
    handler: ({ siteDb }, input) => {
      const canonicalItem = input.canonicalItem.trim();
      const sources = uniqueSorted(
        input.sourceItems.map((entry) => entry.trim()).filter((entry) => entry && entry !== canonicalItem),
      );
      if (sources.length === 0) {
        return {
          canonicalItem,
          mergedItems: [],
          affectedPeople: 0,
          upsertedRows: 0,
          deletedRows: 0,
        };
      }

      const rows = siteDb.all<PersonItemRow>(
        `SELECT person_slug, item, tags_json, detail, extracted_at
         FROM person_items
         WHERE item = ? OR item IN (${sources.map(() => '?').join(', ')})`,
        [canonicalItem, ...sources],
      );

      const byPerson = new Map<string, PersonItemRow[]>();
      for (const row of rows) {
        if (!byPerson.has(row.person_slug)) byPerson.set(row.person_slug, []);
        byPerson.get(row.person_slug)!.push(row);
      }

      let affectedPeople = 0;
      let upsertedRows = 0;
      let deletedRows = 0;

      siteDb.transaction((db) => {
        const upsertStmt = db.prepare(
          `INSERT INTO person_items (person_slug, item, tags_json, detail, extracted_at)
           VALUES (?, ?, ?, ?, ?)
           ON CONFLICT(person_slug, item) DO UPDATE SET
             tags_json = excluded.tags_json,
             detail = COALESCE(excluded.detail, person_items.detail),
             extracted_at = excluded.extracted_at`,
        );
        const deleteStmt = db.prepare(
          'DELETE FROM person_items WHERE person_slug = ? AND item = ?',
        );

        for (const [personSlug, personRows] of byPerson.entries()) {
          const sourceRows = personRows.filter((row) => sources.includes(row.item));
          if (sourceRows.length === 0) continue;
          affectedPeople += 1;

          const canonicalRow = personRows.find((row) => row.item === canonicalItem);
          const mergedTags = uniqueSorted(
            personRows.flatMap((row) => parseTagsJson(row.tags_json)),
          );
          const mergedDetail =
            canonicalRow?.detail ?? sourceRows.find((row) => row.detail)?.detail ?? null;
          const mergedExtractedAt = maxIsoDate(personRows.map((row) => row.extracted_at));

          upsertStmt.run(
            personSlug,
            canonicalItem,
            JSON.stringify(mergedTags),
            mergedDetail,
            mergedExtractedAt,
          );
          upsertedRows += 1;

          for (const row of sourceRows) {
            deleteStmt.run(personSlug, row.item);
            deletedRows += 1;
          }
        }
      });

      return {
        canonicalItem,
        mergedItems: sources,
        affectedPeople,
        upsertedRows,
        deletedRows,
      };
    },
  }),
  defineTool({
    name: 'items.enrichBatch',
    scope: 'items',
    description: 'Use AI to enrich item metadata in batch.',
    inputSchema: enrichItemsInputSchema,
    handler: async ({ siteDb }, input) => {
      let client: ReturnType<typeof createOpenAIClient>;
      try {
        client = createOpenAIClient();
      } catch {
        return input.items.map((entry) => ({
          item: entry.item,
          itemType: null,
          description: null,
          itemUrl: null,
          error: 'OPENAI_API_KEY not configured',
        }));
      }

      const itemList = input.items
        .map((entry) => `- ${entry.item} (tags: ${entry.tags.join(', ')})`)
        .join('\n');

      try {
        const completion = await client.chat.completions.parse({
          model: 'gpt-5-mini',
          messages: [
            {
              role: 'system',
              content: `You classify and describe developer tools, products, and services.

For each item, provide:
- itemType: "product" (physical purchasable item), "service" (paid online service), "software" (app, tool, or open source), or "other"
- description: A concise 1-sentence description
- itemUrl: The official/canonical URL. Use null if you're not confident about the URL.

Do NOT hallucinate URLs. Only provide URLs you are confident are correct.`,
            },
            {
              role: 'user',
              content: `Classify and describe these items:\n${itemList}`,
            },
          ],
          response_format: zodResponseFormat(EnrichmentResultSchema, 'enrichment'),
        });

        const parsed = completion.choices[0]?.message?.parsed;
        if (!parsed) {
          return input.items.map((entry) => ({
            item: entry.item,
            itemType: null,
            description: null,
            itemUrl: null,
            error: 'Failed to parse response',
          }));
        }

        const resultMap = new Map(parsed.items.map((entry) => [entry.item, entry]));
        const results: Array<{
          item: string;
          itemType: string | null;
          description: string | null;
          itemUrl: string | null;
          error?: string;
        }> = [];

        for (const entry of input.items) {
          const enriched = resultMap.get(entry.item);
          const itemSlug = slugify(entry.item) || 'item';

          if (!enriched) {
            results.push({
              item: entry.item,
              itemType: null,
              description: null,
              itemUrl: null,
              error: 'Item not in response',
            });
            continue;
          }

          siteDb.run(
            `INSERT INTO items (item_slug, item_name, item_type, description, item_url, enriched_at)
             VALUES (?, ?, ?, ?, ?, ?)
             ON CONFLICT(item_slug) DO UPDATE SET
               item_name=excluded.item_name,
               item_type=excluded.item_type,
               description=excluded.description,
               item_url=excluded.item_url,
               enriched_at=excluded.enriched_at`,
            [
              itemSlug,
              entry.item,
              enriched.itemType,
              enriched.description,
              enriched.itemUrl,
              new Date().toISOString(),
            ],
          );
          results.push({
            item: entry.item,
            itemType: enriched.itemType,
            description: enriched.description,
            itemUrl: enriched.itemUrl,
          });
        }

        return results;
      } catch (error) {
        return input.items.map((entry) => ({
          item: entry.item,
          itemType: null,
          description: null,
          itemUrl: null,
          error: error instanceof Error ? error.message : 'Enrichment failed',
        }));
      }
    },
  }),
];
