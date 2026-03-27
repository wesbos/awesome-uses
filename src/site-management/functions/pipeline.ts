import { z } from 'zod';
import { eq, and, asc, desc, sql, isNotNull, ne } from 'drizzle-orm';
import { zodResponseFormat } from 'openai/helpers/zod';
import { kmeans } from 'ml-kmeans';
import { UMAP } from 'umap-js';
import * as schema from '../../server/schema';
import { defineTool } from '../registry';
import type { ToolDefinition } from '../types';
import type { SiteManagementContext } from '../context';
import { nonEmptyStringSchema, slugSchema } from '../schemas';
import { ConfigurationError, NotFoundError } from '../errors';
import { createOpenAIClient, extractItemsFromMarkdown, normalizeItems, BANNED_TAGS } from '../../server/extract';
import { scrapeUsesPage, type ScrapePageResult } from '../../server/scrape';
import { fetchGitHubStats } from '../../server/github';
import { getAllPeople, mapConcurrent, normalizeTag, parseTagsJson, uniqueSorted } from './utils';
import type { SiteDb } from '../stores/site-db';

const EMBEDDING_MODEL = 'text-embedding-3-small';

const getScrapeStatusInputSchema = z.object({});

const getScrapeErrorsInputSchema = z.object({
  limit: z.number().int().positive().max(500).default(250),
});

const scrapePersonInputSchema = z.object({
  personSlug: nonEmptyStringSchema,
  timeoutMs: z.number().int().positive().max(60000).default(12000),
  retries: z.number().int().min(0).max(5).default(1),
});

const scrapeBatchInputSchema = z.object({
  personSlugs: z.array(nonEmptyStringSchema).optional(),
  pendingOnly: z.boolean().default(true),
  concurrency: z.number().int().positive().max(50).default(8),
  limit: z.number().int().positive().max(5000).optional(),
  timeoutMs: z.number().int().positive().max(60000).default(12000),
  retries: z.number().int().min(0).max(5).default(1),
});

const rescrapeAndExtractInputSchema = z.object({
  personSlug: nonEmptyStringSchema,
  timeoutMs: z.number().int().positive().max(60000).default(12000),
  retries: z.number().int().min(0).max(5).default(1),
  forceExtract: z.boolean().default(false),
});

const extractBatchInputSchema = z.object({
  limit: z.number().int().positive().max(5000).default(200),
  skipExisting: z.boolean().default(true),
  concurrency: z.number().int().positive().max(25).default(8),
});

const discoverTagsInputSchema = z.object({
  sampleSize: z.number().int().positive().max(500).default(30),
  concurrency: z.number().int().positive().max(25).default(8),
});

const reviewExtractionInputSchema = z.object({});

const previewReclassificationInputSchema = z.object({
  tag: nonEmptyStringSchema,
  minUsers: z.number().int().positive().max(100).default(2),
  limit: z.number().int().positive().max(500).default(80),
  model: z.string().trim().min(1).default('gpt-5-mini'),
  prompt: z.string().trim().optional(),
});

const applyReclassificationInputSchema = z.object({
  tag: nonEmptyStringSchema,
  assignments: z.array(
    z.object({
      item: nonEmptyStringSchema,
      tags: z.array(nonEmptyStringSchema).min(1),
    }),
  ),
});

const vectorizePersonInputSchema = z.object({
  personSlug: nonEmptyStringSchema,
});

const vectorizeBatchInputSchema = z.object({
  limit: z.number().int().positive().max(5000).default(250),
  skipExisting: z.boolean().default(true),
  concurrency: z.number().int().positive().max(25).default(6),
});

const getSimilarPeopleInputSchema = z.object({
  personSlug: nonEmptyStringSchema,
  limit: z.number().int().positive().max(50).default(6),
  minScore: z.number().min(0).max(1).default(0.3),
});

const getGalaxyDataInputSchema = z.object({
  maxPoints: z.number().int().positive().max(5000).default(1500),
});

const ReclassifiedItemSchema = z.object({
  item: z.string(),
  tags: z.array(z.string()),
  reasoning: z.string(),
});

const ReclassifyOutputSchema = z.object({
  items: z.array(ReclassifiedItemSchema),
  newTags: z.array(
    z.object({
      name: z.string(),
      description: z.string(),
      examples: z.array(z.string()),
    }),
  ),
});

function classifyScrapeChangeType(
  previousContentHash: string | null,
  scraped: ScrapePageResult,
): 'initial' | 'updated' | 'unchanged' | 'error' | 'non_html' {
  if (scraped.statusCode === null || scraped.statusCode >= 400) return 'error';
  if (!scraped.contentMarkdown) return 'non_html';
  if (!previousContentHash) return 'initial';
  if (previousContentHash !== scraped.contentHash) return 'updated';
  return 'unchanged';
}

function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length || a.length === 0) return 0;
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let index = 0; index < a.length; index += 1) {
    const av = a[index];
    const bv = b[index];
    dot += av * bv;
    normA += av * av;
    normB += bv * bv;
  }
  if (normA === 0 || normB === 0) return 0;
  return dot / Math.sqrt(normA * normB);
}

function normalizeReclassifyTag(tag: string): string {
  return tag.trim().toLowerCase().replace(/\s+/g, '-');
}

async function scrapeOnePerson(
  context: SiteManagementContext,
  personSlug: string,
  options: { timeoutMs: number; retries: number },
) {
  const people = getAllPeople();
  const person = people.find((entry) => entry.personSlug === personSlug);
  if (!person) {
    throw new NotFoundError(`Person "${personSlug}" was not found.`);
  }

  const previous = await context.db
    .select({ contentHash: schema.personPages.contentHash })
    .from(schema.personPages)
    .where(eq(schema.personPages.personSlug, personSlug))
    .get();

  const scraped = await scrapeUsesPage(person.url, options);
  const fetchedAt = new Date().toISOString();

  await context.db
    .insert(schema.personPages)
    .values({
      personSlug,
      url: person.url,
      statusCode: scraped.statusCode,
      fetchedAt,
      title: scraped.title,
      contentMarkdown: scraped.contentMarkdown,
      contentHash: scraped.contentHash,
    })
    .onConflictDoUpdate({
      target: schema.personPages.personSlug,
      set: {
        url: person.url,
        statusCode: scraped.statusCode,
        fetchedAt,
        title: scraped.title,
        contentMarkdown: scraped.contentMarkdown,
        contentHash: scraped.contentHash,
      },
    })
    .run();

  const changeType = classifyScrapeChangeType(previous?.contentHash ?? null, scraped);

  await context.db
    .insert(schema.personPageEvents)
    .values({
      personSlug,
      url: person.url,
      statusCode: scraped.statusCode,
      fetchedAt,
      contentHash: scraped.contentHash,
      changeType,
      title: scraped.title,
    })
    .run();

  return {
    personSlug,
    url: person.url,
    fetchedAt,
    statusCode: scraped.statusCode,
    title: scraped.title,
    contentHash: scraped.contentHash,
    changeType,
    hasContent: !!scraped.contentMarkdown,
  };
}

async function extractForPerson(
  context: SiteManagementContext,
  personSlug: string,
): Promise<{ itemCount: number; error?: string }> {
  const page = await context.db
    .select({ contentMarkdown: schema.personPages.contentMarkdown })
    .from(schema.personPages)
    .where(eq(schema.personPages.personSlug, personSlug))
    .get();

  if (!page?.contentMarkdown) {
    return { itemCount: 0, error: 'No scraped markdown available.' };
  }

  let client: ReturnType<typeof createOpenAIClient>;
  try {
    client = createOpenAIClient();
  } catch (error) {
    return {
      itemCount: 0,
      error: error instanceof Error ? error.message : 'OPENAI_API_KEY is not configured.',
    };
  }

  const extracted = await extractItemsFromMarkdown(client, page.contentMarkdown);
  const normalized = normalizeItems(extracted.items);
  const extractedAt = new Date().toISOString();

  await context.db.delete(schema.personItems)
    .where(eq(schema.personItems.personSlug, personSlug))
    .run();

  for (const item of normalized) {
    await context.db
      .insert(schema.personItems)
      .values({
        personSlug,
        item: item.item.trim(),
        tagsJson: JSON.stringify(uniqueSorted(item.tags.map(normalizeTag))),
        detail: item.detail,
        extractedAt,
      })
      .onConflictDoUpdate({
        target: [schema.personItems.personSlug, schema.personItems.item],
        set: {
          tagsJson: JSON.stringify(uniqueSorted(item.tags.map(normalizeTag))),
          detail: item.detail,
          extractedAt,
        },
      })
      .run();
  }

  return { itemCount: normalized.length };
}

async function vectorizePersonEmbedding(
  context: SiteManagementContext,
  personSlug: string,
): Promise<{ vectorized: boolean; reason?: string; dimensions?: number }> {
  const page = await context.db
    .select({ contentMarkdown: schema.personPages.contentMarkdown })
    .from(schema.personPages)
    .where(eq(schema.personPages.personSlug, personSlug))
    .get();

  if (!page?.contentMarkdown || page.contentMarkdown.length < 20) {
    return { vectorized: false, reason: 'No sufficient scraped content.' };
  }

  let client: ReturnType<typeof createOpenAIClient>;
  try {
    client = createOpenAIClient();
  } catch (error) {
    return {
      vectorized: false,
      reason: error instanceof Error ? error.message : 'OPENAI_API_KEY is not configured.',
    };
  }

  const itemRows = await context.db
    .select({ item: schema.personItems.item })
    .from(schema.personItems)
    .where(eq(schema.personItems.personSlug, personSlug))
    .orderBy(asc(schema.personItems.item))
    .all();

  const text = [
    `Profile: ${personSlug}`,
    itemRows.length > 0 ? `Items: ${itemRows.map((entry) => entry.item).join(', ')}` : '',
    `Uses page content:\n${page.contentMarkdown.slice(0, 6000)}`,
  ]
    .filter(Boolean)
    .join('\n\n');

  const embeddingResponse = await client.embeddings.create({
    model: EMBEDDING_MODEL,
    input: text,
    dimensions: 1536,
  });
  const embedding = embeddingResponse.data[0]?.embedding;
  if (!embedding || embedding.length === 0) {
    return { vectorized: false, reason: 'Embedding response was empty.' };
  }

  await context.db
    .insert(schema.siteManagementVectors)
    .values({
      personSlug,
      embeddingJson: JSON.stringify(embedding),
      updatedAt: new Date().toISOString(),
    })
    .onConflictDoUpdate({
      target: schema.siteManagementVectors.personSlug,
      set: {
        embeddingJson: JSON.stringify(embedding),
        updatedAt: new Date().toISOString(),
      },
    })
    .run();

  await context.db
    .update(schema.personPages)
    .set({ vectorizedAt: new Date().toISOString() })
    .where(eq(schema.personPages.personSlug, personSlug))
    .run();

  return { vectorized: true, dimensions: embedding.length };
}

function buildExtractionReview(rows: Array<typeof schema.personItems.$inferSelect>) {
  const tagItems = new Map<string, Map<string, Set<string>>>();
  const itemTags = new Map<string, Set<string>>();

  for (const row of rows) {
    const item = row.item.trim();
    if (!item) continue;
    const tags = parseTagsJson(row.tagsJson).map(normalizeTag);
    for (const tag of tags) {
      if (!tagItems.has(tag)) tagItems.set(tag, new Map());
      const items = tagItems.get(tag)!;
      if (!items.has(item)) items.set(item, new Set());
      items.get(item)!.add(row.personSlug);

      if (!itemTags.has(item)) itemTags.set(item, new Set());
      itemTags.get(item)!.add(tag);
    }
  }

  const tags = [...tagItems.entries()]
    .map(([tag, items]) => {
      const totalPeople = new Set([...items.values()].flatMap((people) => [...people])).size;
      const topItems = [...items.entries()]
        .sort((a, b) => b[1].size - a[1].size)
        .slice(0, 15)
        .map(([item, people]) => ({ item, count: people.size }));
      return {
        tag,
        uniqueItems: items.size,
        totalPeople,
        topItems,
      };
    })
    .sort((a, b) => b.uniqueItems - a.uniqueItems);

  const multiTagItems = [...itemTags.entries()]
    .filter(([, t]) => t.size > 2)
    .map(([item, t]) => ({ item, tags: [...t].sort() }))
    .sort((a, b) => b.tags.length - a.tags.length)
    .slice(0, 30);

  const tinyTags = tags
    .filter((entry) => entry.uniqueItems <= 2)
    .map((entry) => ({
      tag: entry.tag,
      items: [...(tagItems.get(entry.tag)?.keys() ?? [])],
    }));

  const bannedLeaks = tags
    .filter((entry) => BANNED_TAGS.includes(entry.tag))
    .map((entry) => ({
      tag: entry.tag,
      uniqueItems: entry.uniqueItems,
    }));

  return {
    totalRows: rows.length,
    totalTags: tags.length,
    tags,
    multiTagItems,
    tinyTags,
    bannedLeaks,
  };
}

export const pipelineTools: ToolDefinition[] = [
  defineTool({
    name: 'pipeline.getScrapeStatus',
    scope: 'pipeline',
    description: 'Get scrape and vectorization status for all people.',
    inputSchema: getScrapeStatusInputSchema,
    handler: async ({ db }) => {
      const people = getAllPeople();
      const scrapes = await db
        .select()
        .from(schema.personPages)
        .all();

      const scrapeMap = new Map(scrapes.map((entry) => [entry.personSlug, entry]));
      const rows = people.map((person) => {
        const scrape = scrapeMap.get(person.personSlug);
        return {
          personSlug: person.personSlug,
          name: person.name,
          url: person.url,
          scraped: !!scrape,
          statusCode: scrape?.statusCode ?? null,
          fetchedAt: scrape?.fetchedAt ?? null,
          title: scrape?.title ?? null,
          vectorized: !!scrape?.vectorizedAt,
        };
      });

      return {
        total: rows.length,
        scraped: rows.filter((entry) => entry.scraped).length,
        vectorized: rows.filter((entry) => entry.vectorized).length,
        rows,
      };
    },
  }),
  defineTool({
    name: 'pipeline.getScrapeErrors',
    scope: 'pipeline',
    description: 'List scraped pages with error status codes.',
    inputSchema: getScrapeErrorsInputSchema,
    handler: async ({ db }, input) => {
      const people = getAllPeople();
      const peopleMap = new Map(people.map((entry) => [entry.personSlug, entry]));

      const rows = await db
        .select()
        .from(schema.personPages)
        .where(
          sql`${schema.personPages.statusCode} IS NULL OR ${schema.personPages.statusCode} >= 400`,
        )
        .orderBy(desc(schema.personPages.fetchedAt))
        .limit(input.limit)
        .all();

      return rows.map((row) => ({
        personSlug: row.personSlug,
        name: peopleMap.get(row.personSlug)?.name ?? row.personSlug,
        url: row.url,
        statusCode: row.statusCode,
        fetchedAt: row.fetchedAt,
        title: row.title,
      }));
    },
  }),
  defineTool({
    name: 'pipeline.scrapePerson',
    scope: 'pipeline',
    description: 'Scrape one person uses page and store it.',
    inputSchema: scrapePersonInputSchema,
    handler: async (context, input) => {
      return scrapeOnePerson(context, input.personSlug, {
        timeoutMs: input.timeoutMs,
        retries: input.retries,
      });
    },
  }),
  defineTool({
    name: 'pipeline.scrapeBatch',
    scope: 'pipeline',
    description: 'Scrape many people uses pages in parallel.',
    inputSchema: scrapeBatchInputSchema,
    handler: async (context, input) => {
      const people = getAllPeople();
      const existing = new Set(
        (await context.db
          .select({ personSlug: schema.personPages.personSlug })
          .from(schema.personPages)
          .all())
          .map((entry) => entry.personSlug),
      );

      let targets = people;
      if (input.personSlugs && input.personSlugs.length > 0) {
        const wanted = new Set(input.personSlugs);
        targets = targets.filter((entry) => wanted.has(entry.personSlug));
      }
      if (input.pendingOnly) {
        targets = targets.filter((entry) => !existing.has(entry.personSlug));
      }
      if (input.limit) {
        targets = targets.slice(0, input.limit);
      }

      const results = await mapConcurrent(
        targets,
        input.concurrency,
        async (person) => {
          try {
            const result = await scrapeOnePerson(context, person.personSlug, {
              timeoutMs: input.timeoutMs,
              retries: input.retries,
            });
            return { ...result, ok: true };
          } catch (error) {
            return {
              personSlug: person.personSlug,
              ok: false,
              error: error instanceof Error ? error.message : 'Scrape failed.',
            };
          }
        },
      );

      return {
        processed: targets.length,
        successes: results.filter((entry) => entry.ok).length,
        failures: results.filter((entry) => !entry.ok).length,
        rows: results,
      };
    },
  }),
  defineTool({
    name: 'pipeline.rescrapeAndExtractPerson',
    scope: 'pipeline',
    description: 'Re-scrape one person and re-extract items when content changes.',
    inputSchema: rescrapeAndExtractInputSchema,
    handler: async (context, input) => {
      const before = await context.db
        .select({ contentHash: schema.personPages.contentHash })
        .from(schema.personPages)
        .where(eq(schema.personPages.personSlug, input.personSlug))
        .get();

      const scrape = await scrapeOnePerson(context, input.personSlug, {
        timeoutMs: input.timeoutMs,
        retries: input.retries,
      });

      const contentChanged = before?.contentHash !== scrape.contentHash;
      if (!input.forceExtract && !contentChanged) {
        return {
          ...scrape,
          contentChanged: false,
          extracted: false,
          itemCount: 0,
        };
      }
      const extraction = await extractForPerson(context, input.personSlug);

      return {
        ...scrape,
        contentChanged: contentChanged || input.forceExtract,
        extracted: !extraction.error,
        itemCount: extraction.itemCount,
        error: extraction.error,
      };
    },
  }),
  defineTool({
    name: 'pipeline.extractBatch',
    scope: 'pipeline',
    description: 'Batch extract person_items from scraped markdown.',
    inputSchema: extractBatchInputSchema,
    handler: async (context, input) => {
      const existingExtracted = new Set(
        (await context.db
          .selectDistinct({ personSlug: schema.personItems.personSlug })
          .from(schema.personItems)
          .all())
          .map((entry) => entry.personSlug),
      );

      const pages = await context.db
        .select({
          personSlug: schema.personPages.personSlug,
          contentMarkdown: schema.personPages.contentMarkdown,
        })
        .from(schema.personPages)
        .where(
          and(
            isNotNull(schema.personPages.contentMarkdown),
            ne(schema.personPages.contentMarkdown, ''),
          ),
        )
        .orderBy(asc(schema.personPages.personSlug))
        .limit(input.limit)
        .all();

      const targets = input.skipExisting
        ? pages.filter((entry) => !existingExtracted.has(entry.personSlug))
        : pages;

      const results = await mapConcurrent(targets, input.concurrency, async (entry) => {
        try {
          const extraction = await extractForPerson(context, entry.personSlug);
          return {
            personSlug: entry.personSlug,
            ok: !extraction.error,
            itemCount: extraction.itemCount,
            error: extraction.error,
          };
        } catch (error) {
          return {
            personSlug: entry.personSlug,
            ok: false,
            itemCount: 0,
            error: error instanceof Error ? error.message : 'Extraction failed.',
          };
        }
      });

      return {
        processed: targets.length,
        totalItems: results.reduce((sum, row) => sum + row.itemCount, 0),
        errors: results.filter((row) => !row.ok).length,
        rows: results,
      };
    },
  }),
  defineTool({
    name: 'pipeline.discoverTags',
    scope: 'pipeline',
    description: 'Sample random pages and estimate top tags/items via extraction.',
    inputSchema: discoverTagsInputSchema,
    handler: async (context, input) => {
      const pages = await context.db
        .select({
          personSlug: schema.personPages.personSlug,
          contentMarkdown: schema.personPages.contentMarkdown,
        })
        .from(schema.personPages)
        .where(
          and(
            isNotNull(schema.personPages.contentMarkdown),
            ne(schema.personPages.contentMarkdown, ''),
          ),
        )
        .orderBy(sql`RANDOM()`)
        .limit(input.sampleSize)
        .all();

      let client: ReturnType<typeof createOpenAIClient>;
      try {
        client = createOpenAIClient();
      } catch (error) {
        throw new ConfigurationError(
          error instanceof Error ? error.message : 'OPENAI_API_KEY is not configured.',
        );
      }

      const extractedItems: Array<{ item: string; tags: string[] }> = [];
      let errors = 0;
      await mapConcurrent(pages, input.concurrency, async (page) => {
        try {
          if (!page.contentMarkdown) return;
          const extraction = await extractItemsFromMarkdown(client, page.contentMarkdown);
          const normalized = normalizeItems(extraction.items);
          for (const item of normalized) {
            extractedItems.push({
              item: item.item.toLowerCase().trim(),
              tags: item.tags.map(normalizeTag),
            });
          }
        } catch {
          errors += 1;
        }
      });

      const tagCounts = new Map<string, number>();
      const itemCounts = new Map<string, number>();
      for (const item of extractedItems) {
        itemCounts.set(item.item, (itemCounts.get(item.item) || 0) + 1);
        for (const tag of item.tags) {
          tagCounts.set(tag, (tagCounts.get(tag) || 0) + 1);
        }
      }

      return {
        sampledPages: pages.length,
        totalItems: extractedItems.length,
        topTags: [...tagCounts.entries()]
          .sort((a, b) => b[1] - a[1])
          .slice(0, 50)
          .map(([tag, count]) => ({ tag, count })),
        topItems: [...itemCounts.entries()]
          .sort((a, b) => b[1] - a[1])
          .slice(0, 50)
          .map(([item, count]) => ({ item, count })),
        errors,
      };
    },
  }),
  defineTool({
    name: 'pipeline.reviewExtraction',
    scope: 'pipeline',
    description: 'Generate extraction quality report from person_items.',
    inputSchema: reviewExtractionInputSchema,
    handler: async ({ db }) => {
      const rows = await db
        .select()
        .from(schema.personItems)
        .orderBy(asc(schema.personItems.item))
        .all();

      return buildExtractionReview(rows);
    },
  }),
  defineTool({
    name: 'pipeline.previewReclassification',
    scope: 'pipeline',
    description: 'Preview AI tag reclassification for one tag.',
    inputSchema: previewReclassificationInputSchema,
    handler: async ({ db }, input) => {
      let client: ReturnType<typeof createOpenAIClient>;
      try {
        client = createOpenAIClient();
      } catch (error) {
        throw new ConfigurationError(
          error instanceof Error ? error.message : 'OPENAI_API_KEY is not configured.',
        );
      }

      const targetTag = normalizeTag(input.tag);
      const rows = await db
        .select()
        .from(schema.personItems)
        .all();

      const allTags = uniqueSorted(
        rows.flatMap((row) => parseTagsJson(row.tagsJson).map(normalizeTag)),
      );
      const itemPeople = new Map<string, Set<string>>();
      for (const row of rows) {
        const tags = parseTagsJson(row.tagsJson).map(normalizeTag);
        if (!tags.includes(targetTag)) continue;
        if (!itemPeople.has(row.item)) itemPeople.set(row.item, new Set());
        itemPeople.get(row.item)!.add(row.personSlug);
      }

      const candidates = [...itemPeople.entries()]
        .map(([item, people]) => ({
          item,
          count: people.size,
          people: [...people],
        }))
        .filter((entry) => entry.count >= input.minUsers)
        .sort((a, b) => b.count - a.count)
        .slice(0, input.limit);

      if (candidates.length === 0) {
        return {
          tag: targetTag,
          minUsers: input.minUsers,
          totalCandidates: 0,
          candidates: [],
          output: { items: [], newTags: [] },
        };
      }

      const prompt =
        input.prompt ||
        `You are reviewing extracted item tags from developer /uses pages.

For each item currently tagged as "{tag}", decide:
1. Which tag or tags it should belong to.
2. Whether it should remain in "{tag}".
3. Whether a new tag is needed (only if at least 3 items clearly need it).

Prefer existing tags whenever possible. Keep tag names short and lowercase-hyphenated.`;

      const completion = await client.chat.completions.parse({
        model: input.model,
        messages: [
          {
            role: 'system',
            content: prompt.replaceAll('{tag}', targetTag),
          },
          {
            role: 'user',
            content: `Existing tags: ${allTags.filter((entry) => entry !== targetTag).join(', ')}

Items currently in "${targetTag}" (${candidates.length}):
${candidates.map((entry) => `- ${entry.item}`).join('\n')}

Rules:
- Prefer existing tags from the list above.
- Keep "${targetTag}" only if still appropriate.
- You may assign multiple tags.
- New tags should only be proposed if at least 3 items clearly require one.`,
          },
        ],
        response_format: zodResponseFormat(ReclassifyOutputSchema, 'reclassification'),
      });

      const parsed = completion.choices[0]?.message?.parsed;
      if (!parsed) {
        throw new ConfigurationError('Failed to parse reclassification output from model.');
      }

      return {
        tag: targetTag,
        minUsers: input.minUsers,
        totalCandidates: candidates.length,
        candidates: candidates.map((entry) => ({ item: entry.item, count: entry.count })),
        output: parsed,
      };
    },
  }),
  defineTool({
    name: 'pipeline.applyReclassification',
    scope: 'pipeline',
    description: 'Apply tag reclassification assignments to person_items.',
    inputSchema: applyReclassificationInputSchema,
    handler: async ({ db }, input) => {
      const tag = normalizeTag(input.tag);
      const assignmentMap = new Map(
        input.assignments.map((entry) => [
          entry.item,
          uniqueSorted(entry.tags.map(normalizeTag)),
        ]),
      );

      const rows = await db
        .select()
        .from(schema.personItems)
        .all();

      let updatedRows = 0;
      const touchedItems = new Set<string>();
      for (const row of rows) {
        const nextTags = assignmentMap.get(row.item);
        if (!nextTags) continue;
        const current = parseTagsJson(row.tagsJson).map(normalizeTag);
        if (!current.includes(tag)) continue;
        const merged = uniqueSorted([...current.filter((entry) => entry !== tag), ...nextTags]);
        if (JSON.stringify(merged) === JSON.stringify(uniqueSorted(current))) continue;

        await db.update(schema.personItems)
          .set({ tagsJson: JSON.stringify(merged) })
          .where(and(
            eq(schema.personItems.personSlug, row.personSlug),
            eq(schema.personItems.item, row.item),
          ))
          .run();
        updatedRows += 1;
        touchedItems.add(row.item);
      }

      return {
        tag,
        updatedRows,
        updatedItems: touchedItems.size,
      };
    },
  }),
  defineTool({
    name: 'pipeline.vectorizePerson',
    scope: 'pipeline',
    description: 'Vectorize one person profile into local management vector store.',
    inputSchema: vectorizePersonInputSchema,
    handler: async (context, input) => {
      const people = getAllPeople();
      if (!people.find((entry) => entry.personSlug === input.personSlug)) {
        throw new NotFoundError(`Person "${input.personSlug}" was not found.`);
      }
      return vectorizePersonEmbedding(context, input.personSlug);
    },
  }),
  defineTool({
    name: 'pipeline.vectorizeBatch',
    scope: 'pipeline',
    description: 'Vectorize many profile embeddings in batch.',
    inputSchema: vectorizeBatchInputSchema,
    handler: async (context, input) => {
      const existing = new Set(
        (await context.db
          .select({ personSlug: schema.siteManagementVectors.personSlug })
          .from(schema.siteManagementVectors)
          .all())
          .map((entry) => entry.personSlug),
      );

      const pages = await context.db
        .select({
          personSlug: schema.personPages.personSlug,
          contentMarkdown: schema.personPages.contentMarkdown,
        })
        .from(schema.personPages)
        .where(
          and(
            isNotNull(schema.personPages.contentMarkdown),
            sql`length(${schema.personPages.contentMarkdown}) > 100`,
          ),
        )
        .orderBy(asc(schema.personPages.personSlug))
        .limit(input.limit)
        .all();

      const targets = input.skipExisting
        ? pages.filter((entry) => !existing.has(entry.personSlug))
        : pages;

      const rows = await mapConcurrent(targets, input.concurrency, async (entry) => {
        try {
          const result = await vectorizePersonEmbedding(context, entry.personSlug);
          return { personSlug: entry.personSlug, ok: result.vectorized, ...result };
        } catch (error) {
          return {
            personSlug: entry.personSlug,
            ok: false,
            vectorized: false,
            reason: error instanceof Error ? error.message : 'Vectorize failed.',
          };
        }
      });

      return {
        processed: targets.length,
        vectorized: rows.filter((entry) => entry.ok).length,
        errors: rows.filter((entry) => !entry.ok).length,
        rows,
      };
    },
  }),
  defineTool({
    name: 'pipeline.getSimilarPeople',
    scope: 'pipeline',
    description: 'Get similar people based on local management vectors.',
    inputSchema: getSimilarPeopleInputSchema,
    handler: async ({ db }, input) => {
      const target = await db
        .select({ embeddingJson: schema.siteManagementVectors.embeddingJson })
        .from(schema.siteManagementVectors)
        .where(eq(schema.siteManagementVectors.personSlug, input.personSlug))
        .get();

      if (!target) {
        throw new NotFoundError(
          `No vector found for "${input.personSlug}". Run pipeline.vectorizePerson first.`,
        );
      }
      const targetVector = JSON.parse(target.embeddingJson) as number[];

      const candidates = await db
        .select({
          personSlug: schema.siteManagementVectors.personSlug,
          embeddingJson: schema.siteManagementVectors.embeddingJson,
        })
        .from(schema.siteManagementVectors)
        .where(ne(schema.siteManagementVectors.personSlug, input.personSlug))
        .all();

      const rows = candidates
        .map((entry) => ({
          personSlug: entry.personSlug,
          score: cosineSimilarity(targetVector, JSON.parse(entry.embeddingJson) as number[]),
        }))
        .filter((entry) => entry.score >= input.minScore)
        .sort((a, b) => b.score - a.score)
        .slice(0, input.limit);

      return {
        personSlug: input.personSlug,
        similar: rows,
      };
    },
  }),
  defineTool({
    name: 'pipeline.getGalaxyData',
    scope: 'pipeline',
    description: 'Generate 2D cluster projection for vectorized people.',
    inputSchema: getGalaxyDataInputSchema,
    handler: async ({ db }, input) => {
      const vectors = (await db
        .select({
          personSlug: schema.siteManagementVectors.personSlug,
          embeddingJson: schema.siteManagementVectors.embeddingJson,
        })
        .from(schema.siteManagementVectors)
        .orderBy(asc(schema.siteManagementVectors.personSlug))
        .all())
        .slice(0, input.maxPoints)
        .map((entry) => ({
          personSlug: entry.personSlug,
          values: JSON.parse(entry.embeddingJson) as number[],
        }))
        .filter((entry) => entry.values.length > 0);

      if (vectors.length < 5) {
        return { points: [], clusters: [] };
      }

      const embeddings = vectors.map((entry) => entry.values);
      const umap = new UMAP({
        nComponents: 2,
        nNeighbors: Math.max(2, Math.min(15, Math.floor(vectors.length / 2))),
        minDist: 0.1,
        spread: 1,
      });
      const positions = umap.fit(embeddings);
      const clusterCount = Math.max(2, Math.min(12, Math.floor(vectors.length / 3)));
      const clustering = kmeans(embeddings, clusterCount, { initialization: 'kmeans++' });

      const points = vectors.map((entry, index) => ({
        personSlug: entry.personSlug,
        x: positions[index][0],
        y: positions[index][1],
        cluster: clustering.clusters[index],
      }));

      const itemsByPerson = new Map<string, string[]>();
      const itemRows = await db
        .select({
          personSlug: schema.personItems.personSlug,
          item: schema.personItems.item,
        })
        .from(schema.personItems)
        .orderBy(asc(schema.personItems.personSlug), asc(schema.personItems.item))
        .all();

      for (const row of itemRows) {
        if (!itemsByPerson.has(row.personSlug)) itemsByPerson.set(row.personSlug, []);
        itemsByPerson.get(row.personSlug)!.push(row.item);
      }

      const clusterMembers = new Map<number, string[]>();
      for (const point of points) {
        if (!clusterMembers.has(point.cluster)) clusterMembers.set(point.cluster, []);
        clusterMembers.get(point.cluster)!.push(point.personSlug);
      }

      const clusters = [...clusterMembers.entries()]
        .map(([id, members]) => {
          const itemCounts = new Map<string, number>();
          for (const member of members) {
            for (const item of itemsByPerson.get(member) ?? []) {
              itemCounts.set(item, (itemCounts.get(item) || 0) + 1);
            }
          }
          const topItems = [...itemCounts.entries()]
            .sort((a, b) => b[1] - a[1])
            .slice(0, 8)
            .map(([item]) => item);
          const label = topItems.slice(0, 3).join(', ') || `Cluster ${id + 1}`;
          return { id, label, topItems, count: members.length };
        })
        .sort((a, b) => b.count - a.count);

      return { points, clusters };
    },
  }),
  defineTool({
    name: 'pipeline.getGitHubStatus',
    scope: 'pipeline',
    description: 'Get GitHub profile fetch status for all people, showing who has cached data and when it expires.',
    inputSchema: z.object({}),
    handler: async ({ db }) => {
      const people = getAllPeople();
      const cached = await db.select().from(schema.githubProfiles).all();
      const cacheMap = new Map(cached.map((row) => [row.personSlug, row]));

      const now = new Date();
      const rows = people
        .filter((p) => !!p.github)
        .map((person) => {
          const cache = cacheMap.get(person.personSlug);
          return {
            personSlug: person.personSlug,
            name: person.name,
            github: person.github!,
            fetched: !!cache,
            fetchedAt: cache?.fetchedAt ?? null,
            expired: cache ? new Date(cache.expiresAt) <= now : true,
          };
        });

      return {
        total: rows.length,
        fetched: rows.filter((r) => r.fetched).length,
        expired: rows.filter((r) => r.expired).length,
        fresh: rows.filter((r) => r.fetched && !r.expired).length,
        rows,
      };
    },
  }),
  defineTool({
    name: 'pipeline.fetchGitHubProfile',
    scope: 'pipeline',
    description: 'Fetch (or refresh) GitHub profile data for one person and cache it for 1 week.',
    inputSchema: z.object({
      personSlug: slugSchema,
      force: z.boolean().default(false).describe('Force refresh even if cached data is still fresh.'),
    }),
    handler: async ({ db }, input) => {
      const people = getAllPeople();
      const person = people.find((p) => p.personSlug === input.personSlug);
      if (!person) throw new NotFoundError(`Person "${input.personSlug}" not found.`);
      if (!person.github) throw new NotFoundError(`Person "${input.personSlug}" has no GitHub username.`);

      if (!input.force) {
        const cached = await db
          .select()
          .from(schema.githubProfiles)
          .where(eq(schema.githubProfiles.personSlug, input.personSlug))
          .get();
        if (cached && new Date(cached.expiresAt) > new Date()) {
          return {
            personSlug: input.personSlug,
            github: person.github,
            status: 'cached' as const,
            fetchedAt: cached.fetchedAt,
            expiresAt: cached.expiresAt,
          };
        }
      }

      const stats = await fetchGitHubStats(person.github);
      if (!stats) {
        return {
          personSlug: input.personSlug,
          github: person.github,
          status: 'failed' as const,
          error: 'GitHub API returned no data. Check GITHUB_TOKEN.',
        };
      }

      const now = new Date();
      const ONE_WEEK_MS = 7 * 24 * 60 * 60 * 1000;
      const expiresAt = new Date(now.getTime() + ONE_WEEK_MS).toISOString();

      await db
        .insert(schema.githubProfiles)
        .values({
          personSlug: input.personSlug,
          githubUsername: person.github,
          dataJson: JSON.stringify(stats),
          fetchedAt: now.toISOString(),
          expiresAt,
        })
        .onConflictDoUpdate({
          target: schema.githubProfiles.personSlug,
          set: {
            githubUsername: person.github,
            dataJson: JSON.stringify(stats),
            fetchedAt: now.toISOString(),
            expiresAt,
          },
        })
        .run();

      return {
        personSlug: input.personSlug,
        github: person.github,
        status: 'fetched' as const,
        fetchedAt: now.toISOString(),
        expiresAt,
        stats,
      };
    },
  }),
  defineTool({
    name: 'pipeline.fetchGitHubBatch',
    scope: 'pipeline',
    description: 'Batch fetch GitHub profiles for people who have a GitHub username. Respects cache.',
    inputSchema: z.object({
      personSlugs: z.array(nonEmptyStringSchema).optional().describe('Specific person slugs to fetch. If omitted, fetches all with GitHub usernames.'),
      limit: z.number().int().positive().max(500).default(50),
      concurrency: z.number().int().positive().max(10).default(3),
      pendingOnly: z.boolean().default(true).describe('Only fetch people without fresh cached data.'),
    }),
    handler: async (context, input) => {
      const people = getAllPeople().filter((p) => !!p.github);
      const cached = await context.db.select().from(schema.githubProfiles).all();
      const cacheMap = new Map(cached.map((row) => [row.personSlug, row]));
      const now = new Date();

      let targets = people;
      if (input.personSlugs && input.personSlugs.length > 0) {
        const wanted = new Set(input.personSlugs);
        targets = targets.filter((p) => wanted.has(p.personSlug));
      }
      if (input.pendingOnly) {
        targets = targets.filter((p) => {
          const cache = cacheMap.get(p.personSlug);
          return !cache || new Date(cache.expiresAt) <= now;
        });
      }
      targets = targets.slice(0, input.limit);

      const ONE_WEEK_MS = 7 * 24 * 60 * 60 * 1000;
      const results = await mapConcurrent(targets, input.concurrency, async (person) => {
        try {
          const stats = await fetchGitHubStats(person.github!);
          if (!stats) return { personSlug: person.personSlug, ok: false, error: 'No data returned' };

          const fetchedAt = new Date().toISOString();
          const expiresAt = new Date(Date.now() + ONE_WEEK_MS).toISOString();

          await context.db
            .insert(schema.githubProfiles)
            .values({
              personSlug: person.personSlug,
              githubUsername: person.github!,
              dataJson: JSON.stringify(stats),
              fetchedAt,
              expiresAt,
            })
            .onConflictDoUpdate({
              target: schema.githubProfiles.personSlug,
              set: {
                githubUsername: person.github!,
                dataJson: JSON.stringify(stats),
                fetchedAt,
                expiresAt,
              },
            })
            .run();

          return { personSlug: person.personSlug, ok: true };
        } catch (error) {
          return {
            personSlug: person.personSlug,
            ok: false,
            error: error instanceof Error ? error.message : 'Fetch failed',
          };
        }
      });

      return {
        processed: targets.length,
        successes: results.filter((r) => r.ok).length,
        failures: results.filter((r) => !r.ok).length,
        rows: results,
      };
    },
  }),
];
