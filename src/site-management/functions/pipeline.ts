import { z } from 'zod';
import { zodResponseFormat } from 'openai/helpers/zod';
import { kmeans } from 'ml-kmeans';
import { UMAP } from 'umap-js';
import { defineTool } from '../registry';
import type { ToolDefinition } from '../types';
import { nonEmptyStringSchema } from '../schemas';
import { ConfigurationError, NotFoundError } from '../errors';
import { createOpenAIClient, extractItemsFromMarkdown, normalizeItems, BANNED_CATEGORIES } from '../../server/extract';
import { scrapeUsesPage, type ScrapePageResult } from '../../server/scrape';
import { mapConcurrent, normalizeCategory, parseTagsJson, uniqueSorted } from './utils';

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

const discoverCategoriesInputSchema = z.object({
  sampleSize: z.number().int().positive().max(500).default(30),
  concurrency: z.number().int().positive().max(25).default(8),
});

const reviewExtractionInputSchema = z.object({});

const previewReclassificationInputSchema = z.object({
  category: nonEmptyStringSchema,
  minUsers: z.number().int().positive().max(100).default(2),
  limit: z.number().int().positive().max(500).default(80),
  model: z.string().trim().min(1).default('gpt-5-mini'),
  prompt: z.string().trim().optional(),
});

const applyReclassificationInputSchema = z.object({
  category: nonEmptyStringSchema,
  assignments: z.array(
    z.object({
      item: nonEmptyStringSchema,
      categories: z.array(nonEmptyStringSchema).min(1),
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
  categories: z.array(z.string()),
  reasoning: z.string(),
});

const ReclassifyOutputSchema = z.object({
  items: z.array(ReclassifiedItemSchema),
  newCategories: z.array(
    z.object({
      name: z.string(),
      description: z.string(),
      examples: z.array(z.string()),
    }),
  ),
});

type ScrapedPageRow = {
  person_slug: string;
  url: string;
  status_code: number | null;
  fetched_at: string;
  title: string | null;
  content_markdown: string | null;
  content_hash: string | null;
  vectorized_at: string | null;
};

type PersonItemRow = {
  person_slug: string;
  item: string;
  tags_json: string;
  detail: string | null;
  extracted_at: string;
};

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

function ensureVectorTable(siteDb: {
  run: (sql: string, params?: unknown[]) => unknown;
}) {
  siteDb.run(
    `CREATE TABLE IF NOT EXISTS site_management_vectors (
      person_slug TEXT PRIMARY KEY,
      embedding_json TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )`,
  );
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

function normalizeReclassifyCategory(category: string): string {
  return category.trim().toLowerCase().replace(/\s+/g, '-');
}

async function scrapeOnePerson(
  context: Parameters<ToolDefinition['handler']>[0],
  personSlug: string,
  options: { timeoutMs: number; retries: number },
) {
  const people = await context.peopleStore.listPeopleWithSlugs();
  const person = people.find((entry) => entry.personSlug === personSlug);
  if (!person) {
    throw new NotFoundError(`Person "${personSlug}" was not found.`);
  }

  const previous = context.siteDb.get<{ content_hash: string | null }>(
    'SELECT content_hash FROM person_pages WHERE person_slug = ?',
    [personSlug],
  );

  const scraped = await scrapeUsesPage(person.url, options);
  const fetchedAt = new Date().toISOString();
  context.siteDb.run(
    `INSERT INTO person_pages (
      person_slug, url, status_code, fetched_at, title, content_markdown, content_hash
    ) VALUES (?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(person_slug) DO UPDATE SET
      url=excluded.url,
      status_code=excluded.status_code,
      fetched_at=excluded.fetched_at,
      title=excluded.title,
      content_markdown=excluded.content_markdown,
      content_hash=excluded.content_hash`,
    [
      personSlug,
      person.url,
      scraped.statusCode,
      fetchedAt,
      scraped.title,
      scraped.contentMarkdown,
      scraped.contentHash,
    ],
  );

  const changeType = classifyScrapeChangeType(previous?.content_hash ?? null, scraped);
  context.siteDb.run(
    `INSERT INTO person_page_events (
      person_slug, url, status_code, fetched_at, content_hash, change_type, title
    ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      personSlug,
      person.url,
      scraped.statusCode,
      fetchedAt,
      scraped.contentHash,
      changeType,
      scraped.title,
    ],
  );

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
  context: Parameters<ToolDefinition['handler']>[0],
  personSlug: string,
): Promise<{ itemCount: number; error?: string }> {
  const page = context.siteDb.get<{
    content_markdown: string | null;
  }>('SELECT content_markdown FROM person_pages WHERE person_slug = ?', [personSlug]);

  if (!page?.content_markdown) {
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

  const extracted = await extractItemsFromMarkdown(client, page.content_markdown);
  const normalized = normalizeItems(extracted.items);
  const extractedAt = new Date().toISOString();

  context.siteDb.transaction((db) => {
    db.prepare('DELETE FROM person_items WHERE person_slug = ?').run(personSlug);
    if (normalized.length === 0) return;
    const insertStmt = db.prepare(
      `INSERT INTO person_items (person_slug, item, tags_json, detail, extracted_at)
       VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(person_slug, item) DO UPDATE SET
         tags_json=excluded.tags_json,
         detail=excluded.detail,
         extracted_at=excluded.extracted_at`,
    );
    for (const item of normalized) {
      insertStmt.run(
        personSlug,
        item.item.trim(),
        JSON.stringify(uniqueSorted(item.categories.map(normalizeCategory))),
        item.detail,
        extractedAt,
      );
    }
  });

  return { itemCount: normalized.length };
}

async function vectorizePersonEmbedding(
  context: Parameters<ToolDefinition['handler']>[0],
  personSlug: string,
): Promise<{ vectorized: boolean; reason?: string; dimensions?: number }> {
  const page = context.siteDb.get<{ content_markdown: string | null }>(
    'SELECT content_markdown FROM person_pages WHERE person_slug = ?',
    [personSlug],
  );

  if (!page?.content_markdown || page.content_markdown.length < 20) {
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

  const itemRows = context.siteDb.all<{ item: string }>(
    'SELECT item FROM person_items WHERE person_slug = ? ORDER BY item',
    [personSlug],
  );
  const text = [
    `Profile: ${personSlug}`,
    itemRows.length > 0 ? `Items: ${itemRows.map((entry) => entry.item).join(', ')}` : '',
    `Uses page content:\n${page.content_markdown.slice(0, 6000)}`,
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

  ensureVectorTable(context.siteDb);
  context.siteDb.run(
    `INSERT INTO site_management_vectors (person_slug, embedding_json, updated_at)
     VALUES (?, ?, ?)
     ON CONFLICT(person_slug) DO UPDATE SET
       embedding_json = excluded.embedding_json,
       updated_at = excluded.updated_at`,
    [personSlug, JSON.stringify(embedding), new Date().toISOString()],
  );
  context.siteDb.run(
    'UPDATE person_pages SET vectorized_at = ? WHERE person_slug = ?',
    [new Date().toISOString(), personSlug],
  );

  return { vectorized: true, dimensions: embedding.length };
}

function buildExtractionReview(rows: PersonItemRow[]) {
  const categoryItems = new Map<string, Map<string, Set<string>>>();
  const itemCategories = new Map<string, Set<string>>();

  for (const row of rows) {
    const item = row.item.trim();
    if (!item) continue;
    const categories = parseTagsJson(row.tags_json).map(normalizeCategory);
    for (const category of categories) {
      if (!categoryItems.has(category)) categoryItems.set(category, new Map());
      const items = categoryItems.get(category)!;
      if (!items.has(item)) items.set(item, new Set());
      items.get(item)!.add(row.person_slug);

      if (!itemCategories.has(item)) itemCategories.set(item, new Set());
      itemCategories.get(item)!.add(category);
    }
  }

  const categories = [...categoryItems.entries()]
    .map(([category, items]) => {
      const totalPeople = new Set([...items.values()].flatMap((people) => [...people])).size;
      const topItems = [...items.entries()]
        .sort((a, b) => b[1].size - a[1].size)
        .slice(0, 15)
        .map(([item, people]) => ({ item, count: people.size }));
      return {
        category,
        uniqueItems: items.size,
        totalPeople,
        topItems,
      };
    })
    .sort((a, b) => b.uniqueItems - a.uniqueItems);

  const multiCategoryItems = [...itemCategories.entries()]
    .filter(([, tags]) => tags.size > 2)
    .map(([item, tags]) => ({ item, categories: [...tags].sort() }))
    .sort((a, b) => b.categories.length - a.categories.length)
    .slice(0, 30);

  const tinyCategories = categories
    .filter((entry) => entry.uniqueItems <= 2)
    .map((entry) => ({
      category: entry.category,
      items: [...(categoryItems.get(entry.category)?.keys() ?? [])],
    }));

  const bannedLeaks = categories
    .filter((entry) => BANNED_CATEGORIES.includes(entry.category))
    .map((entry) => ({
      category: entry.category,
      uniqueItems: entry.uniqueItems,
    }));

  return {
    totalRows: rows.length,
    totalCategories: categories.length,
    categories,
    multiCategoryItems,
    tinyCategories,
    bannedLeaks,
  };
}

export const pipelineTools: ToolDefinition[] = [
  defineTool({
    name: 'pipeline.getScrapeStatus',
    scope: 'pipeline',
    description: 'Get scrape and vectorization status for all people.',
    inputSchema: getScrapeStatusInputSchema,
    handler: async ({ peopleStore, siteDb }) => {
      const people = await peopleStore.listPeopleWithSlugs();
      const scrapes = siteDb.all<ScrapedPageRow>(
        `SELECT person_slug, url, status_code, fetched_at, title, content_markdown, content_hash, vectorized_at
         FROM person_pages`,
      );
      const scrapeMap = new Map(scrapes.map((entry) => [entry.person_slug, entry]));
      const rows = people.map((person) => {
        const scrape = scrapeMap.get(person.personSlug);
        return {
          personSlug: person.personSlug,
          name: person.name,
          url: person.url,
          scraped: !!scrape,
          statusCode: scrape?.status_code ?? null,
          fetchedAt: scrape?.fetched_at ?? null,
          title: scrape?.title ?? null,
          vectorized: !!scrape?.vectorized_at,
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
    handler: async ({ peopleStore, siteDb }, input) => {
      const people = await peopleStore.listPeopleWithSlugs();
      const peopleMap = new Map(people.map((entry) => [entry.personSlug, entry]));
      const rows = siteDb.all<ScrapedPageRow>(
        `SELECT person_slug, url, status_code, fetched_at, title, content_markdown, content_hash, vectorized_at
         FROM person_pages
         WHERE status_code IS NULL OR status_code >= 400
         ORDER BY fetched_at DESC
         LIMIT ?`,
        [input.limit],
      );
      return rows.map((row) => ({
        personSlug: row.person_slug,
        name: peopleMap.get(row.person_slug)?.name ?? row.person_slug,
        url: row.url,
        statusCode: row.status_code,
        fetchedAt: row.fetched_at,
        title: row.title,
      }));
    },
  }),
  defineTool({
    name: 'pipeline.scrapePerson',
    scope: 'pipeline',
    description: 'Scrape one person uses page and store it in D1.',
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
      const people = await context.peopleStore.listPeopleWithSlugs();
      const existing = new Set(
        context.siteDb
          .all<{ person_slug: string }>('SELECT person_slug FROM person_pages')
          .map((entry) => entry.person_slug),
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
      const before = context.siteDb.get<{ content_hash: string | null }>(
        'SELECT content_hash FROM person_pages WHERE person_slug = ?',
        [input.personSlug],
      );
      const scrape = await scrapeOnePerson(context, input.personSlug, {
        timeoutMs: input.timeoutMs,
        retries: input.retries,
      });

      const contentChanged = before?.content_hash !== scrape.contentHash;
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
        context.siteDb
          .all<{ person_slug: string }>('SELECT DISTINCT person_slug FROM person_items')
          .map((entry) => entry.person_slug),
      );
      const pages = context.siteDb.all<{ person_slug: string; content_markdown: string | null }>(
        `SELECT person_slug, content_markdown
         FROM person_pages
         WHERE content_markdown IS NOT NULL AND content_markdown != ''
         ORDER BY person_slug
         LIMIT ?`,
        [input.limit],
      );
      const targets = input.skipExisting
        ? pages.filter((entry) => !existingExtracted.has(entry.person_slug))
        : pages;

      const results = await mapConcurrent(targets, input.concurrency, async (entry) => {
        try {
          const extraction = await extractForPerson(context, entry.person_slug);
          return {
            personSlug: entry.person_slug,
            ok: !extraction.error,
            itemCount: extraction.itemCount,
            error: extraction.error,
          };
        } catch (error) {
          return {
            personSlug: entry.person_slug,
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
    name: 'pipeline.discoverCategories',
    scope: 'pipeline',
    description: 'Sample random pages and estimate top categories/items via extraction.',
    inputSchema: discoverCategoriesInputSchema,
    handler: async (context, input) => {
      const pages = context.siteDb.all<{ person_slug: string; content_markdown: string | null }>(
        `SELECT person_slug, content_markdown
         FROM person_pages
         WHERE content_markdown IS NOT NULL AND content_markdown != ''
         ORDER BY RANDOM()
         LIMIT ?`,
        [input.sampleSize],
      );

      let client: ReturnType<typeof createOpenAIClient>;
      try {
        client = createOpenAIClient();
      } catch (error) {
        throw new ConfigurationError(
          error instanceof Error ? error.message : 'OPENAI_API_KEY is not configured.',
        );
      }

      const extractedItems: Array<{ item: string; categories: string[] }> = [];
      let errors = 0;
      await mapConcurrent(pages, input.concurrency, async (page) => {
        try {
          if (!page.content_markdown) return;
          const extraction = await extractItemsFromMarkdown(client, page.content_markdown);
          const normalized = normalizeItems(extraction.items);
          for (const item of normalized) {
            extractedItems.push({
              item: item.item.toLowerCase().trim(),
              categories: item.categories.map(normalizeCategory),
            });
          }
        } catch {
          errors += 1;
        }
      });

      const categoryCounts = new Map<string, number>();
      const itemCounts = new Map<string, number>();
      for (const item of extractedItems) {
        itemCounts.set(item.item, (itemCounts.get(item.item) || 0) + 1);
        for (const category of item.categories) {
          categoryCounts.set(category, (categoryCounts.get(category) || 0) + 1);
        }
      }

      return {
        sampledPages: pages.length,
        totalItems: extractedItems.length,
        topCategories: [...categoryCounts.entries()]
          .sort((a, b) => b[1] - a[1])
          .slice(0, 50)
          .map(([category, count]) => ({ category, count })),
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
    handler: ({ siteDb }) => {
      const rows = siteDb.all<PersonItemRow>(
        'SELECT person_slug, item, tags_json, detail, extracted_at FROM person_items ORDER BY item',
      );
      return buildExtractionReview(rows);
    },
  }),
  defineTool({
    name: 'pipeline.previewReclassification',
    scope: 'pipeline',
    description: 'Preview AI category reclassification for one category.',
    inputSchema: previewReclassificationInputSchema,
    handler: async ({ siteDb }, input) => {
      let client: ReturnType<typeof createOpenAIClient>;
      try {
        client = createOpenAIClient();
      } catch (error) {
        throw new ConfigurationError(
          error instanceof Error ? error.message : 'OPENAI_API_KEY is not configured.',
        );
      }

      const targetCategory = normalizeCategory(input.category);
      const rows = siteDb.all<PersonItemRow>(
        'SELECT person_slug, item, tags_json, detail, extracted_at FROM person_items',
      );

      const allCategories = uniqueSorted(
        rows.flatMap((row) => parseTagsJson(row.tags_json).map(normalizeCategory)),
      );
      const itemPeople = new Map<string, Set<string>>();
      for (const row of rows) {
        const categories = parseTagsJson(row.tags_json).map(normalizeCategory);
        if (!categories.includes(targetCategory)) continue;
        if (!itemPeople.has(row.item)) itemPeople.set(row.item, new Set());
        itemPeople.get(row.item)!.add(row.person_slug);
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
          category: targetCategory,
          minUsers: input.minUsers,
          totalCandidates: 0,
          candidates: [],
          output: {
            items: [],
            newCategories: [],
          },
        };
      }

      const prompt =
        input.prompt ||
        `You are reviewing extracted item tags from developer /uses pages.

For each item currently tagged as "{category}", decide:
1. Which category or categories it should belong to.
2. Whether it should remain in "{category}".
3. Whether a new category is needed (only if at least 3 items clearly need it).

Prefer existing categories whenever possible. Keep category names short and lowercase-hyphenated.`;

      const completion = await client.chat.completions.parse({
        model: input.model,
        messages: [
          {
            role: 'system',
            content: prompt.replaceAll('{category}', targetCategory),
          },
          {
            role: 'user',
            content: `Existing categories: ${allCategories.filter((entry) => entry !== targetCategory).join(', ')}

Items currently in "${targetCategory}" (${candidates.length}):
${candidates.map((entry) => `- ${entry.item}`).join('\n')}

Rules:
- Prefer existing categories from the list above.
- Keep "${targetCategory}" only if still appropriate.
- You may assign multiple categories.
- New categories should only be proposed if at least 3 items clearly require one.`,
          },
        ],
        response_format: zodResponseFormat(ReclassifyOutputSchema, 'reclassification'),
      });

      const parsed = completion.choices[0]?.message?.parsed;
      if (!parsed) {
        throw new ConfigurationError('Failed to parse reclassification output from model.');
      }

      return {
        category: targetCategory,
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
    description: 'Apply category reclassification assignments to person_items.',
    inputSchema: applyReclassificationInputSchema,
    handler: ({ siteDb }, input) => {
      const category = normalizeCategory(input.category);
      const assignmentMap = new Map(
        input.assignments.map((entry) => [
          entry.item,
          uniqueSorted(entry.categories.map(normalizeCategory)),
        ]),
      );
      const rows = siteDb.all<PersonItemRow>(
        'SELECT person_slug, item, tags_json, detail, extracted_at FROM person_items',
      );
      let updatedRows = 0;
      const touchedItems = new Set<string>();
      for (const row of rows) {
        const nextCategories = assignmentMap.get(row.item);
        if (!nextCategories) continue;
        const current = parseTagsJson(row.tags_json).map(normalizeCategory);
        if (!current.includes(category)) continue;
        const merged = uniqueSorted([...current.filter((entry) => entry !== category), ...nextCategories]);
        if (JSON.stringify(merged) === JSON.stringify(uniqueSorted(current))) continue;
        siteDb.run(
          'UPDATE person_items SET tags_json = ? WHERE person_slug = ? AND item = ?',
          [JSON.stringify(merged), row.person_slug, row.item],
        );
        updatedRows += 1;
        touchedItems.add(row.item);
      }
      return {
        category,
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
      const people = await context.peopleStore.listPeopleWithSlugs();
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
      ensureVectorTable(context.siteDb);
      const existing = new Set(
        context.siteDb
          .all<{ person_slug: string }>('SELECT person_slug FROM site_management_vectors')
          .map((entry) => entry.person_slug),
      );
      const pages = context.siteDb.all<{ person_slug: string; content_markdown: string | null }>(
        `SELECT person_slug, content_markdown FROM person_pages
         WHERE content_markdown IS NOT NULL AND length(content_markdown) > 100
         ORDER BY person_slug
         LIMIT ?`,
        [input.limit],
      );
      const targets = input.skipExisting
        ? pages.filter((entry) => !existing.has(entry.person_slug))
        : pages;

      const rows = await mapConcurrent(targets, input.concurrency, async (entry) => {
        try {
          const result = await vectorizePersonEmbedding(context, entry.person_slug);
          return { personSlug: entry.person_slug, ok: result.vectorized, ...result };
        } catch (error) {
          return {
            personSlug: entry.person_slug,
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
    handler: ({ siteDb }, input) => {
      ensureVectorTable(siteDb);
      const target = siteDb.get<{ embedding_json: string }>(
        'SELECT embedding_json FROM site_management_vectors WHERE person_slug = ?',
        [input.personSlug],
      );
      if (!target) {
        throw new NotFoundError(
          `No vector found for "${input.personSlug}". Run pipeline.vectorizePerson first.`,
        );
      }
      const targetVector = JSON.parse(target.embedding_json) as number[];
      const candidates = siteDb.all<{ person_slug: string; embedding_json: string }>(
        'SELECT person_slug, embedding_json FROM site_management_vectors WHERE person_slug != ?',
        [input.personSlug],
      );
      const rows = candidates
        .map((entry) => ({
          personSlug: entry.person_slug,
          score: cosineSimilarity(targetVector, JSON.parse(entry.embedding_json) as number[]),
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
    handler: ({ siteDb }, input) => {
      ensureVectorTable(siteDb);
      const vectors = siteDb
        .all<{ person_slug: string; embedding_json: string }>(
          'SELECT person_slug, embedding_json FROM site_management_vectors ORDER BY person_slug',
        )
        .slice(0, input.maxPoints)
        .map((entry) => ({
          personSlug: entry.person_slug,
          values: JSON.parse(entry.embedding_json) as number[],
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
      const itemRows = siteDb.all<{ person_slug: string; item: string }>(
        'SELECT person_slug, item FROM person_items ORDER BY person_slug, item',
      );
      for (const row of itemRows) {
        if (!itemsByPerson.has(row.person_slug)) itemsByPerson.set(row.person_slug, []);
        itemsByPerson.get(row.person_slug)!.push(row.item);
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
          return {
            id,
            label,
            topItems,
            count: members.length,
          };
        })
        .sort((a, b) => b.count - a.count);

      return {
        points,
        clusters,
      };
    },
  }),
];
