import { z } from 'zod';
import { eq, and, asc, inArray, sql } from 'drizzle-orm';
import { zodResponseFormat } from 'openai/helpers/zod';
import { slugify } from '../../lib/slug';
import * as schema from '../../server/schema';
import { defineTool } from '../registry';
import type { ToolDefinition } from '../types';
import { maybeArraySchema, nonEmptyStringSchema, optionalTrimmedStringSchema } from '../schemas';
import { NotFoundError } from '../errors';
import { parseTagsJson, uniqueSorted } from './utils';
import { createOpenAIClient } from '../../server/extract';
import type { SiteDb } from '../stores/site-db';

const listItemsInputSchema = z.object({
  q: z.string().trim().optional(),
  tag: z.string().trim().optional(),
  itemType: z.string().trim().optional(),
  includePeople: z.boolean().default(false).describe('Include the list of personSlugs who use each item.'),
  limit: z.number().int().positive().max(100).default(10),
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

function maxIsoDate(values: string[]): string {
  return values.sort((a, b) => b.localeCompare(a))[0] || new Date().toISOString();
}

function collectUniqueItems(rows: Array<typeof schema.personItems.$inferSelect>) {
  const itemToPeople = new Map<string, Set<string>>();
  const itemToTags = new Map<string, Set<string>>();

  for (const row of rows) {
    const item = row.item.trim();
    if (!item) continue;
    if (!itemToPeople.has(item)) itemToPeople.set(item, new Set());
    if (!itemToTags.has(item)) itemToTags.set(item, new Set());
    itemToPeople.get(item)!.add(row.personSlug);
    for (const tag of parseTagsJson(row.tagsJson)) {
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

async function queryAllPersonItemRows(db: SiteDb) {
  return await db
    .select()
    .from(schema.personItems)
    .orderBy(asc(schema.personItems.item))
    .all();
}

export const itemTools: ToolDefinition[] = [
  defineTool({
    name: 'items.list',
    scope: 'items',
    description: 'List canonical items with enrichment + usage counts. Optionally filter by tag.',
    inputSchema: listItemsInputSchema,
    handler: async ({ db }, input) => {
      const enrichments = await db
        .select()
        .from(schema.items)
        .all();

      const personItemRows = await queryAllPersonItemRows(db);
      const uniqueItems = collectUniqueItems(personItemRows);
      const enrichmentMap = new Map(enrichments.map((row) => [row.itemSlug, row]));

      const rows = uniqueItems.map((entry) => {
        const enrichment = enrichmentMap.get(entry.itemSlug);
        return {
          item: entry.item,
          itemSlug: entry.itemSlug,
          count: entry.count,
          tags: entry.tags,
          ...(input.includePeople ? { people: entry.people } : {}),
          itemType: enrichment?.itemType ?? null,
          description: enrichment?.description ?? null,
          itemUrl: enrichment?.itemUrl ?? null,
          enrichedAt: enrichment?.enrichedAt ?? null,
        };
      });

      const filtered = rows.filter((row) => {
        if (input.q) {
          const haystack =
            `${row.item} ${row.tags.join(' ')} ${row.description ?? ''} ${row.itemUrl ?? ''}`.toLowerCase();
          if (!haystack.includes(input.q.toLowerCase())) return false;
        }
        if (input.tag && !row.tags.some((t) => t === input.tag)) return false;
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
    handler: async ({ db }, input) => {
      const enrichment = await db
        .select()
        .from(schema.items)
        .where(eq(schema.items.itemSlug, input.itemSlug))
        .get();

      const allRows = await queryAllPersonItemRows(db);
      const matched = allRows.filter(
        (entry) => (slugify(entry.item) || 'item') === input.itemSlug,
      );

      if (!enrichment && matched.length === 0) {
        throw new NotFoundError(`Item "${input.itemSlug}" was not found.`);
      }

      const itemName = enrichment?.itemName ?? matched[0]?.item ?? input.itemSlug;
      const tags = uniqueSorted(matched.flatMap((entry) => parseTagsJson(entry.tagsJson)));
      const people = uniqueSorted(matched.map((entry) => entry.personSlug));
      return {
        itemSlug: input.itemSlug,
        itemName,
        itemType: enrichment?.itemType ?? null,
        description: enrichment?.description ?? null,
        itemUrl: enrichment?.itemUrl ?? null,
        enrichedAt: enrichment?.enrichedAt ?? null,
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
    handler: async ({ db }, input) => {
      const itemSlug = input.itemSlug ?? slugify(input.itemName) ?? 'item';
      const enrichedAt = new Date().toISOString();

      await db.insert(schema.items)
        .values({
          itemSlug,
          itemName: input.itemName,
          itemType: input.itemType ?? null,
          description: input.description ?? null,
          itemUrl: input.itemUrl ?? null,
          enrichedAt,
        })
        .onConflictDoUpdate({
          target: schema.items.itemSlug,
          set: {
            itemName: input.itemName,
            itemType: input.itemType ?? null,
            description: input.description ?? null,
            itemUrl: input.itemUrl ?? null,
            enrichedAt,
          },
        })
        .run();

      return await db
        .select()
        .from(schema.items)
        .where(eq(schema.items.itemSlug, itemSlug))
        .get() ?? null;
    },
  }),
  defineTool({
    name: 'items.update',
    scope: 'items',
    description: 'Update canonical item enrichment row.',
    inputSchema: updateItemInputSchema,
    handler: async ({ db }, input) => {
      const existing = await db
        .select()
        .from(schema.items)
        .where(eq(schema.items.itemSlug, input.itemSlug))
        .get();

      if (!existing) {
        throw new NotFoundError(`Item "${input.itemSlug}" was not found.`);
      }

      await db.update(schema.items)
        .set({
          itemName: input.patch.itemName ?? existing.itemName,
          itemType: typeof input.patch.itemType !== 'undefined' ? input.patch.itemType ?? null : existing.itemType,
          description: typeof input.patch.description !== 'undefined' ? input.patch.description ?? null : existing.description,
          itemUrl: typeof input.patch.itemUrl !== 'undefined' ? input.patch.itemUrl ?? null : existing.itemUrl,
          enrichedAt: new Date().toISOString(),
        })
        .where(eq(schema.items.itemSlug, input.itemSlug))
        .run();

      return await db
        .select()
        .from(schema.items)
        .where(eq(schema.items.itemSlug, input.itemSlug))
        .get() ?? null;
    },
  }),
  defineTool({
    name: 'items.delete',
    scope: 'items',
    description: 'Delete canonical item enrichment row.',
    inputSchema: deleteItemInputSchema,
    handler: async ({ db }, input) => {
      const result = await db
        .delete(schema.items)
        .where(eq(schema.items.itemSlug, input.itemSlug))
        .run();

      return { deleted: result.changes };
    },
  }),
  defineTool({
    name: 'items.findDuplicates',
    scope: 'items',
    description: 'Detect duplicate item names in extracted person_items.',
    inputSchema: findDuplicatesInputSchema,
    handler: async ({ db }, input) => {
      const rows = await queryAllPersonItemRows(db);
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
    handler: async ({ db }, input) => {
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

      const targets = [canonicalItem, ...sources];
      const rows = await db
        .select()
        .from(schema.personItems)
        .where(inArray(schema.personItems.item, targets))
        .all();

      const byPerson = new Map<string, Array<typeof schema.personItems.$inferSelect>>();
      for (const row of rows) {
        if (!byPerson.has(row.personSlug)) byPerson.set(row.personSlug, []);
        byPerson.get(row.personSlug)!.push(row);
      }

      let affectedPeople = 0;
      let upsertedRows = 0;
      let deletedRows = 0;

      for (const [personSlug, personRows] of byPerson.entries()) {
        const sourceRows = personRows.filter((row) => sources.includes(row.item));
        if (sourceRows.length === 0) continue;
        affectedPeople += 1;

        const canonicalRow = personRows.find((row) => row.item === canonicalItem);
        const mergedTags = uniqueSorted(
          personRows.flatMap((row) => parseTagsJson(row.tagsJson)),
        );
        const mergedDetail =
          canonicalRow?.detail ?? sourceRows.find((row) => row.detail)?.detail ?? null;
        const mergedExtractedAt = maxIsoDate(personRows.map((row) => row.extractedAt));

        await db.insert(schema.personItems)
          .values({
            personSlug,
            item: canonicalItem,
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
          })
          .run();
        upsertedRows += 1;

        for (const row of sourceRows) {
          await db.delete(schema.personItems)
            .where(and(
              eq(schema.personItems.personSlug, personSlug),
              eq(schema.personItems.item, row.item),
            ))
            .run();
          deletedRows += 1;
        }
      }

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
    handler: async ({ db }, input) => {
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

          await db.insert(schema.items)
            .values({
              itemSlug,
              itemName: entry.item,
              itemType: enriched.itemType,
              description: enriched.description,
              itemUrl: enriched.itemUrl,
              enrichedAt: new Date().toISOString(),
            })
            .onConflictDoUpdate({
              target: schema.items.itemSlug,
              set: {
                itemName: entry.item,
                itemType: enriched.itemType,
                description: enriched.description,
                itemUrl: enriched.itemUrl,
                enrichedAt: new Date().toISOString(),
              },
            })
            .run();

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
