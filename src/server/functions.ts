import { createServerFn } from '@tanstack/react-start';
import { env as cfEnv } from 'cloudflare:workers';
import { getPersonBySlug, getAllPeople } from '../lib/data';
import type { PersonItem, ScrapedProfileData } from '../lib/types';
import type { TagSummary } from './d1';
import {
  getScrapedProfileBySlug,
  upsertScrapedProfile,
  getAllScrapeSummaries,
  getPersonItems,
  getAllTagSummaries,
  getTagDetailBySlug,
  getItemDetailBySlug,
  getItemDetailByName,
  getRecentScrapeEvents,
  getScrapeHistoryStats,
  getPersonScrapeHistory,
  searchItems,
  mergeItemsIntoCanonical,
  getExtractedCategories,
  applyTagReclassification,
  getScrapedContent,
  deletePersonItems,
  insertPersonItems,
  getErrorPeople,
  getAllUniqueItems,
  getAllItemEnrichments,
  getItemEnrichment,
  upsertItemEnrichment,
  getAllScrapedPersonSlugs,
  getItemsByPerson,
  markVectorized,
  getScrapedPagesForExtraction,
  getRandomScrapedPages,
  getProfilesForVectorization,
  findDuplicateItems,
  getExtractionReviewData,
  type ReclassifyAssignment,
  type ItemDetail,
  type TagDetail,
  type DuplicateGroup,
  type ExtractionReviewData,
} from './d1';
import { scrapeUsesPage } from './scrape';
import { searchAmazonProducts, type AmazonProductSearchResult } from './amazon';
import {
  getAnalyticsDashboardData,
  writeViewEvent,
  type ViewEntityType,
} from './analytics';
import { previewTagReclassification } from './reclassify';
import {
  createOpenAIClient,
  extractItemsFromMarkdown,
  normalizeItems,
  BANNED_CATEGORIES,
} from './extract';
import { slugify } from '../lib/slug';
import { getAvatarUrl } from '../lib/avatar';

const BATCH_CONCURRENCY = 10;

async function mapConcurrent<T, R>(
  values: T[],
  concurrency: number,
  mapper: (value: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results: R[] = new Array(values.length);
  let nextIndex = 0;

  async function worker() {
    while (nextIndex < values.length) {
      const current = nextIndex;
      nextIndex += 1;
      results[current] = await mapper(values[current], current);
    }
  }

  await Promise.all(Array.from({ length: Math.min(concurrency, values.length) }, worker));
  return results;
}

type ScrapeResult = {
  data: ScrapedProfileData | null;
  mode: 'existing' | 'scraped-on-demand' | 'missing-person';
};

export const $getScrapedProfile = createServerFn({ method: 'GET' })
  .inputValidator((personSlug: string) => personSlug)
  .handler(async ({ data: personSlug }): Promise<ScrapeResult> => {
    const existing = await getScrapedProfileBySlug(personSlug);
    if (existing) {
      return { data: existing, mode: 'existing' };
    }

    const person = getPersonBySlug(personSlug);
    if (!person) {
      return { data: null, mode: 'missing-person' };
    }

    const fetchedAt = new Date().toISOString();
    const scraped = await scrapeUsesPage(person.url);
    await upsertScrapedProfile(person.personSlug, person.url, fetchedAt, scraped);

    const created = await getScrapedProfileBySlug(personSlug);
    if (created) {
      return { data: created, mode: 'scraped-on-demand' };
    }

    return {
      data: {
        personSlug: person.personSlug,
        url: person.url,
        statusCode: scraped.statusCode,
        fetchedAt,
        title: scraped.title,
        contentMarkdown: scraped.contentMarkdown,
      },
      mode: 'scraped-on-demand',
    };
  });

export const $getPersonItems = createServerFn({ method: 'GET' })
  .inputValidator((personSlug: string) => personSlug)
  .handler(async ({ data: personSlug }): Promise<PersonItem[]> => {
    return getPersonItems(personSlug);
  });

export type DashboardRow = {
  personSlug: string;
  name: string;
  url: string;
  statusCode: number | null;
  fetchedAt: string | null;
  title: string | null;
  scraped: boolean;
  vectorized: boolean;
};

export type DashboardPayload = {
  total: number;
  scraped: number;
  vectorized: number;
  rows: DashboardRow[];
};

export const $getScrapeStatus = createServerFn({ method: 'GET' }).handler(
  async (): Promise<DashboardPayload> => {
    const [scrapes, people] = await Promise.all([
      getAllScrapeSummaries(),
      Promise.resolve(getAllPeople()),
    ]);

    const scrapeMap = new Map(scrapes.map((s) => [s.personSlug, s]));

    let vectorizedCount = 0;
    const rows: DashboardRow[] = people.map((person) => {
      const scrape = scrapeMap.get(person.personSlug);
      const vectorized = !!scrape?.vectorizedAt;
      if (vectorized) vectorizedCount++;
      return {
        personSlug: person.personSlug,
        name: person.name,
        url: person.url,
        statusCode: scrape?.statusCode ?? null,
        fetchedAt: scrape?.fetchedAt ?? null,
        title: scrape?.title ?? null,
        scraped: !!scrape,
        vectorized,
      };
    });

    return { total: people.length, scraped: scrapes.length, vectorized: vectorizedCount, rows };
  }
);

export type Face = { personSlug: string; name: string; avatarUrl: string; description?: string };

export type TagItemWithFaces = {
  item: string;
  itemSlug: string;
  count: number;
  faces: Face[];
};

export type TagSummaryWithFaces = Omit<TagSummary, 'topItems' | 'personSlugs'> & {
  faces: Face[];
  topItems: TagItemWithFaces[];
};

function slugToFace(
  slug: string,
  peopleMap: Map<string, ReturnType<typeof getAllPeople>[number]>,
  { includeDescription = false }: { includeDescription?: boolean } = {},
): Face | null {
  const person = peopleMap.get(slug);
  if (!person) return null;
  const face: Face = {
    personSlug: person.personSlug,
    name: person.name,
    avatarUrl: getAvatarUrl(person),
  };
  if (includeDescription) {
    face.description = person.description;
  }
  return face;
}

export const $getTagSummaries = createServerFn({ method: 'GET' }).handler(
  async (): Promise<TagSummaryWithFaces[]> => {
    const tags = await getAllTagSummaries();
    const allPeople = getAllPeople();
    const peopleMap = new Map(allPeople.map((p) => [p.personSlug, p]));

    return tags.map((tag) => ({
      ...tag,
      faces: tag.personSlugs
        .map((slug) => slugToFace(slug, peopleMap))
        .filter((f): f is Face => f !== null),
      topItems: tag.topItems.map((ti) => ({
        item: ti.item,
        itemSlug: ti.itemSlug,
        count: ti.count,
        faces: ti.personSlugs
          .map((slug) => slugToFace(slug, peopleMap))
          .filter((f): f is Face => f !== null),
      })),
    }));
  }
);

export type TagDetailWithFaces = Omit<TagDetail, 'people' | 'items'> & {
  faces: Face[];
  items: TagItemWithFaces[];
};

export const $getTagDetail = createServerFn({ method: 'GET' })
  .inputValidator((tagSlug: string) => tagSlug)
  .handler(async ({ data: tagSlug }): Promise<TagDetailWithFaces | null> => {
    const detail = await getTagDetailBySlug(tagSlug);
    if (!detail) return null;

    const allPeople = getAllPeople();
    const peopleMap = new Map(allPeople.map((p) => [p.personSlug, p]));

    return {
      tag: detail.tag,
      tagSlug: detail.tagSlug,
      totalItems: detail.totalItems,
      totalPeople: detail.totalPeople,
      faces: detail.people
        .map((slug) => slugToFace(slug, peopleMap))
        .filter((f): f is Face => f !== null),
      items: detail.items.map((item) => ({
        item: item.item,
        itemSlug: item.itemSlug,
        count: item.count,
        faces: item.personSlugs
          .map((slug) => slugToFace(slug, peopleMap))
          .filter((f): f is Face => f !== null),
      })),
    };
  });

type ItemTagRelationWithFaces = {
  tag: string;
  tagSlug: string;
  faces: Face[];
  relatedItems: TagItemWithFaces[];
};

export type ItemDetailWithFaces = Omit<ItemDetail, 'people' | 'tagRelations' | 'tags'> & {
  faces: Face[];
  tags: Array<{ name: string; slug: string }>;
  tagRelations: ItemTagRelationWithFaces[];
  amazon: AmazonProductSearchResult;
  itemType: string | null;
  description: string | null;
  itemUrl: string | null;
};

function mapItemDetailWithFaces(detail: ItemDetail): Omit<ItemDetailWithFaces, 'amazon' | 'itemType' | 'description' | 'itemUrl'> {
  const allPeople = getAllPeople();
  const peopleMap = new Map(allPeople.map((p) => [p.personSlug, p]));

  return {
    item: detail.item,
    itemSlug: detail.itemSlug,
    totalPeople: detail.totalPeople,
    faces: detail.people
      .map((slug) => slugToFace(slug, peopleMap, { includeDescription: true }))
      .filter((f): f is Face => f !== null),
    tags: detail.tags.map((name) => {
      const relation = detail.tagRelations.find((entry) => entry.tag === name);
      return {
        name,
        slug: relation?.tagSlug || name.toLowerCase(),
      };
    }),
    tagRelations: detail.tagRelations.map((relation) => ({
      tag: relation.tag,
      tagSlug: relation.tagSlug,
      faces: relation.people
        .map((slug) => slugToFace(slug, peopleMap))
        .filter((f): f is Face => f !== null),
      relatedItems: relation.relatedItems.map((item) => ({
        item: item.item,
        itemSlug: item.itemSlug,
        count: item.count,
        faces: item.personSlugs
          .map((slug) => slugToFace(slug, peopleMap))
          .filter((f): f is Face => f !== null),
      })),
    })),
  };
}

export const $getItemDetail = createServerFn({ method: 'GET' })
  .inputValidator((itemSlug: string) => itemSlug)
  .handler(async ({ data: itemSlug }): Promise<ItemDetailWithFaces | null> => {
    const detail =
      (await getItemDetailBySlug(itemSlug)) ||
      (await getItemDetailByName(itemSlug.replaceAll('-', ' ')));
    if (!detail) return null;

    const itemSlugResolved = slugify(detail.item) || 'item';
    const [mappedDetail, amazon, enrichment] = await Promise.all([
      Promise.resolve(mapItemDetailWithFaces(detail)),
      searchAmazonProducts(detail.item),
      getItemEnrichment(itemSlugResolved).catch(() => null),
    ]);

    return {
      ...mappedDetail,
      amazon,
      itemType: enrichment?.itemType ?? null,
      description: enrichment?.description ?? null,
      itemUrl: enrichment?.itemUrl ?? null,
    };
  });

type TrackViewInput = {
  entityType: ViewEntityType;
  entityKey: string;
  route: string;
};

export const $trackView = createServerFn({ method: 'POST' })
  .inputValidator((input: TrackViewInput) => input)
  .handler(async ({ data }) => {
    writeViewEvent(data);
    return { ok: true };
  });

export type AdminDashboardData = {
  scrapeStats: Awaited<ReturnType<typeof getScrapeHistoryStats>>;
  recentScrapeEvents: Awaited<ReturnType<typeof getRecentScrapeEvents>>;
  personScrapeHistory: Awaited<ReturnType<typeof getPersonScrapeHistory>>;
  analytics: Awaited<ReturnType<typeof getAnalyticsDashboardData>>;
  categories: string[];
};

export const $getAdminDashboardData = createServerFn({ method: 'GET' }).handler(
  async (): Promise<AdminDashboardData> => {
    const [scrapeStats, recentScrapeEvents, personScrapeHistory, analytics, categories] =
      await Promise.all([
        getScrapeHistoryStats().catch(() => ({
          totalEvents: 0,
          initialEvents: 0,
          updatedEvents: 0,
          unchangedEvents: 0,
          errorEvents: 0,
          nonHtmlEvents: 0,
          peopleUpdated: 0,
          lastEventAt: null,
        })),
        getRecentScrapeEvents(80).catch(() => []),
        getPersonScrapeHistory().catch(() => []),
        getAnalyticsDashboardData(30).catch(() => ({
          available: false,
          reason: 'Analytics unavailable.',
          timeframeDays: 30,
          people: [],
          tags: [],
          items: [],
        })),
        getExtractedCategories().catch(() => []),
      ]);

    return {
      scrapeStats,
      recentScrapeEvents,
      personScrapeHistory,
      analytics,
      categories,
    };
  }
);

type ReclassifyPreviewInput = {
  category: string;
  minUsers: number;
  limit: number;
  prompt?: string;
  model?: string;
};

export type ReclassifyPreviewPayload = Awaited<
  ReturnType<typeof previewTagReclassification>
>;

export const $previewTagReclassify = createServerFn({ method: 'POST' })
  .inputValidator((input: ReclassifyPreviewInput) => input)
  .handler(async ({ data }) => {
    return previewTagReclassification(data);
  });

type ApplyReclassifyInput = {
  category: string;
  assignments: ReclassifyAssignment[];
};

export const $applyTagReclassify = createServerFn({ method: 'POST' })
  .inputValidator((input: ApplyReclassifyInput) => input)
  .handler(async ({ data }) => {
    return applyTagReclassification(data.category, data.assignments);
  });

export const $searchItems = createServerFn({ method: 'GET' })
  .inputValidator((query: string) => query)
  .handler(async ({ data }) => {
    try {
      return await searchItems(data);
    } catch (error) {
      console.error('$searchItems error:', error);
      throw error;
    }
  });

type MergeItemsInput = {
  canonicalItem: string;
  sourceItems: string[];
};

export const $mergeItems = createServerFn({ method: 'POST' })
  .inputValidator((input: MergeItemsInput) => input)
  .handler(async ({ data }) => {
    try {
      return await mergeItemsIntoCanonical(data.canonicalItem, data.sourceItems);
    } catch (error) {
      console.error('$mergeItems error:', error);
      throw error;
    }
  });

type ReScrapeAndExtractInput = {
  personSlug: string;
};

type ReScrapeAndExtractResult = {
  personSlug: string;
  scraped: boolean;
  contentChanged: boolean;
  extracted: boolean;
  itemCount: number;
  error?: string;
};

export const $reScrapeAndExtract = createServerFn({ method: 'POST' })
  .inputValidator((input: ReScrapeAndExtractInput) => input)
  .handler(async ({ data }): Promise<ReScrapeAndExtractResult> => {
    const person = getPersonBySlug(data.personSlug);
    if (!person) {
      return { personSlug: data.personSlug, scraped: false, contentChanged: false, extracted: false, itemCount: 0, error: 'Person not found' };
    }

    const oldContent = await getScrapedContent(data.personSlug);
    const fetchedAt = new Date().toISOString();
    const scraped = await scrapeUsesPage(person.url);
    await upsertScrapedProfile(person.personSlug, person.url, fetchedAt, scraped);

    const contentChanged = oldContent?.contentHash !== scraped.contentHash;

    if (!contentChanged || !scraped.contentMarkdown) {
      if (scraped.contentMarkdown) {
        try {
          const client = createOpenAIClient();
          const items = await getPersonItems(data.personSlug);
          await vectorizeProfile(data.personSlug, scraped.contentMarkdown, items.map((i) => i.item), client);
        } catch (vecErr) {
          console.error('Vectorize upsert failed (non-fatal):', vecErr);
        }
      }
      return { personSlug: data.personSlug, scraped: true, contentChanged, extracted: false, itemCount: 0 };
    }

    try {
      const client = createOpenAIClient();
      const result = await extractItemsFromMarkdown(client, scraped.contentMarkdown);
      const normalized = normalizeItems(result.items);

      if (normalized.length === 0) {
        return { personSlug: data.personSlug, scraped: true, contentChanged: true, extracted: false, itemCount: 0 };
      }

      await deletePersonItems(data.personSlug);

      const extractedAt = new Date().toISOString();
      const rows = normalized.map((item) => ({
        personSlug: data.personSlug,
        item: item.item.trim(),
        tagsJson: JSON.stringify(item.categories),
        detail: item.detail,
        extractedAt,
      }));

      await insertPersonItems(rows);

      try {
        await vectorizeProfile(
          data.personSlug,
          scraped.contentMarkdown,
          rows.map((r) => r.item),
          client,
        );
      } catch (vecErr) {
        console.error('Vectorize upsert failed (non-fatal):', vecErr);
      }

      return { personSlug: data.personSlug, scraped: true, contentChanged: true, extracted: true, itemCount: rows.length };
    } catch (err) {
      return {
        personSlug: data.personSlug,
        scraped: true,
        contentChanged: true,
        extracted: false,
        itemCount: 0,
        error: err instanceof Error ? err.message : 'Extraction failed',
      };
    }
  });

// ---------------------------------------------------------------------------
// Batch Extract Items
// ---------------------------------------------------------------------------

type BatchExtractInput = {
  limit: number;
  skipExisting: boolean;
};

export type BatchExtractResult = {
  processed: number;
  totalItems: number;
  errors: number;
  results: Array<{ personSlug: string; itemCount: number; error?: string }>;
};

export const $batchExtractItems = createServerFn({ method: 'POST' })
  .inputValidator((input: BatchExtractInput) => input)
  .handler(async ({ data }): Promise<BatchExtractResult> => {
    const pages = await getScrapedPagesForExtraction({
      skipExisting: data.skipExisting,
      limit: data.limit,
    });

    if (pages.length === 0) {
      return { processed: 0, totalItems: 0, errors: 0, results: [] };
    }

    let client: InstanceType<typeof import('openai').default>;
    try {
      client = createOpenAIClient();
    } catch {
      return { processed: 0, totalItems: 0, errors: 0, results: [{ personSlug: '', itemCount: 0, error: 'OPENAI_API_KEY not configured' }] };
    }

    let totalItems = 0;
    let errors = 0;

    const results = await mapConcurrent(pages, BATCH_CONCURRENCY, async (page) => {
      try {
        const extraction = await extractItemsFromMarkdown(client, page.contentMarkdown);
        const normalized = normalizeItems(extraction.items);

        if (normalized.length > 0) {
          await deletePersonItems(page.personSlug);
          const extractedAt = new Date().toISOString();
          const rows = normalized.map((item) => ({
            personSlug: page.personSlug,
            item: item.item.trim(),
            tagsJson: JSON.stringify(item.categories),
            detail: item.detail,
            extractedAt,
          }));
          await insertPersonItems(rows);
          totalItems += normalized.length;
        }

        return { personSlug: page.personSlug, itemCount: normalized.length };
      } catch (err) {
        errors++;
        return {
          personSlug: page.personSlug,
          itemCount: 0,
          error: err instanceof Error ? err.message : 'Extraction failed',
        };
      }
    });

    return { processed: pages.length, totalItems, errors, results };
  });

// ---------------------------------------------------------------------------
// Batch Vectorize
// ---------------------------------------------------------------------------

type BatchVectorizeInput = {
  limit: number;
  skipExisting: boolean;
};

export type BatchVectorizeResult = {
  processed: number;
  vectorized: number;
  errors: number;
};

export const $batchVectorize = createServerFn({ method: 'POST' })
  .inputValidator((input: BatchVectorizeInput) => input)
  .handler(async ({ data }): Promise<BatchVectorizeResult> => {
    const profiles = await getProfilesForVectorization({
      skipExisting: data.skipExisting,
      limit: data.limit,
    });

    if (profiles.length === 0) {
      return { processed: 0, vectorized: 0, errors: 0 };
    }

    let client: InstanceType<typeof import('openai').default>;
    try {
      client = createOpenAIClient();
    } catch {
      return { processed: 0, vectorized: 0, errors: 0 };
    }

    let vectorized = 0;
    let errors = 0;

    await mapConcurrent(profiles, BATCH_CONCURRENCY, async (profile) => {
      try {
        const items = await getPersonItems(profile.personSlug);
        await vectorizeProfile(
          profile.personSlug,
          profile.contentMarkdown,
          items.map((i) => i.item),
          client,
        );
        vectorized++;
      } catch {
        errors++;
      }
    });

    return { processed: profiles.length, vectorized, errors };
  });

// ---------------------------------------------------------------------------
// Find Duplicate Items
// ---------------------------------------------------------------------------

export { type DuplicateGroup };

export const $findDuplicateItems = createServerFn({ method: 'GET' }).handler(
  async (): Promise<DuplicateGroup[]> => {
    return findDuplicateItems();
  },
);

// ---------------------------------------------------------------------------
// Discover Categories
// ---------------------------------------------------------------------------

type DiscoverCategoriesInput = {
  sampleSize: number;
};

export type DiscoverCategoriesResult = {
  sampledPages: number;
  totalItems: number;
  topCategories: Array<{ category: string; count: number }>;
  topItems: Array<{ item: string; count: number }>;
  errors: number;
};

export const $discoverCategories = createServerFn({ method: 'POST' })
  .inputValidator((input: DiscoverCategoriesInput) => input)
  .handler(async ({ data }): Promise<DiscoverCategoriesResult> => {
    const pages = await getRandomScrapedPages(data.sampleSize);

    if (pages.length === 0) {
      return { sampledPages: 0, totalItems: 0, topCategories: [], topItems: [], errors: 0 };
    }

    let client: InstanceType<typeof import('openai').default>;
    try {
      client = createOpenAIClient();
    } catch {
      return { sampledPages: 0, totalItems: 0, topCategories: [], topItems: [], errors: 0 };
    }

    const allItems: Array<{ item: string; categories: string[] }> = [];
    let errors = 0;

    await mapConcurrent(pages, BATCH_CONCURRENCY, async (page) => {
      try {
        const extraction = await extractItemsFromMarkdown(client, page.contentMarkdown);
        const normalized = normalizeItems(extraction.items);
        for (const item of normalized) {
          allItems.push({ item: item.item, categories: item.categories });
        }
      } catch {
        errors++;
      }
    });

    const categoryCounts = new Map<string, number>();
    const itemCounts = new Map<string, number>();

    for (const item of allItems) {
      const normalizedItem = item.item.toLowerCase().trim();
      itemCounts.set(normalizedItem, (itemCounts.get(normalizedItem) || 0) + 1);
      for (const cat of item.categories) {
        const c = cat.toLowerCase().trim();
        categoryCounts.set(c, (categoryCounts.get(c) || 0) + 1);
      }
    }

    const topCategories = [...categoryCounts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 50)
      .map(([category, count]) => ({ category, count }));

    const topItems = [...itemCounts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 50)
      .map(([item, count]) => ({ item, count }));

    return {
      sampledPages: pages.length,
      totalItems: allItems.length,
      topCategories,
      topItems,
      errors,
    };
  });

// ---------------------------------------------------------------------------
// Extraction Review
// ---------------------------------------------------------------------------

export { type ExtractionReviewData };

export const $getExtractionReview = createServerFn({ method: 'GET' }).handler(
  async (): Promise<ExtractionReviewData> => {
    return getExtractionReviewData(BANNED_CATEGORIES);
  },
);

export const $getErrorPeople = createServerFn({ method: 'GET' }).handler(
  async () => {
    const errorRows = await getErrorPeople();
    const allPeople = getAllPeople();
    const peopleMap = new Map(allPeople.map((p) => [p.personSlug, p]));

    return errorRows.map((row) => {
      const person = peopleMap.get(row.personSlug);
      return {
        ...row,
        name: person?.name ?? row.personSlug,
      };
    });
  }
);

export const $getErrorSlugs = createServerFn({ method: 'GET' }).handler(
  async (): Promise<string[]> => {
    const errorRows = await getErrorPeople();
    return errorRows.map((r) => r.personSlug);
  }
);

export type ItemsDashboardRow = {
  item: string;
  itemSlug: string;
  count: number;
  tags: string[];
  itemType: string | null;
  description: string | null;
  itemUrl: string | null;
  enrichedAt: string | null;
};

export const $getItemsDashboard = createServerFn({ method: 'GET' }).handler(
  async (): Promise<ItemsDashboardRow[]> => {
    const [uniqueItems, enrichments] = await Promise.all([
      getAllUniqueItems(),
      getAllItemEnrichments(),
    ]);

    const enrichmentMap = new Map(enrichments.map((e) => [e.itemSlug, e]));

    return uniqueItems.map((item) => {
      const itemSlug = slugify(item.item) || 'item';
      const enrichment = enrichmentMap.get(itemSlug);
      return {
        item: item.item,
        itemSlug,
        count: item.count,
        tags: item.tags,
        itemType: enrichment?.itemType ?? null,
        description: enrichment?.description ?? null,
        itemUrl: enrichment?.itemUrl ?? null,
        enrichedAt: enrichment?.enrichedAt ?? null,
      };
    });
  }
);

export type SimilarPerson = Face & { score: number };

type VectorizeMatch = {
  id: string;
  score: number;
  metadata?: Record<string, string> | null;
};

type VectorizeQueryResult = {
  count: number;
  matches: VectorizeMatch[];
};

type VectorizeVector = {
  id: string;
  values: number[];
  metadata?: Record<string, string>;
};

type VectorizeIndex = {
  queryById(
    id: string,
    options?: { topK?: number; returnMetadata?: 'none' | 'indexed' | 'all'; returnValues?: boolean },
  ): Promise<VectorizeQueryResult>;
  upsert(vectors: VectorizeVector[]): Promise<{ mutationId: string }>;
  getByIds(ids: string[]): Promise<VectorizeVector[]>;
};

function resolveVectorize(): VectorizeIndex | null {
  return (cfEnv as { VECTORIZE?: VectorizeIndex }).VECTORIZE ?? null;
}

const EMBEDDING_MODEL = 'text-embedding-3-small';

async function vectorizeProfile(
  personSlug: string,
  contentMarkdown: string,
  itemNames: string[],
  openaiClient: InstanceType<typeof import('openai').default>,
): Promise<void> {
  const vectorize = resolveVectorize();
  console.log(`[vectorize] ${personSlug}: binding=${!!vectorize}`);
  if (!vectorize) return;

  const parts = [`Profile: ${personSlug}`];
  if (itemNames.length > 0) {
    parts.push(`Tools and gear: ${itemNames.join(', ')}`);
  }
  parts.push(`Uses page content:\n${contentMarkdown.slice(0, 6000)}`);

  const input = parts.join('\n\n');
  console.log(`[vectorize] ${personSlug}: generating embedding (${input.length} chars)`);

  const response = await openaiClient.embeddings.create({
    model: EMBEDDING_MODEL,
    input,
    dimensions: 1536,
  });

  const values = response.data[0]?.embedding;
  console.log(`[vectorize] ${personSlug}: embedding dimensions=${values?.length ?? 0}`);
  if (!values?.length) return;

  const result = await vectorize.upsert([{
    id: personSlug,
    values,
    metadata: { personSlug },
  }]);
  console.log(`[vectorize] ${personSlug}: upsert result=`, JSON.stringify(result));
  await markVectorized(personSlug);
}

export type VectorizeDebug = {
  hasBinding: boolean;
  personSlug: string;
  rawJson: string;
  error: string | null;
};

export const $getSimilarPeople = createServerFn({ method: 'GET' })
  .inputValidator((personSlug: string) => personSlug)
  .handler(async ({ data: personSlug }): Promise<{ similar: SimilarPerson[]; debug: VectorizeDebug }> => {
    const vectorize = resolveVectorize();
    const debug: VectorizeDebug = {
      hasBinding: !!vectorize,
      personSlug,
      rawJson: '{}',
      error: null,
    };

    if (!vectorize) return { similar: [], debug };

    try {
      const results = await vectorize.queryById(personSlug, {
        topK: 7,
        returnMetadata: 'none',
      });

      debug.rawJson = JSON.stringify(results, null, 2);

      if (!results?.matches?.length) return { similar: [], debug };

      const allPeople = getAllPeople();
      const peopleMap = new Map(allPeople.map((p) => [p.personSlug, p]));

      const similar = results.matches
        .filter((m) => m.id !== personSlug && m.score > 0.3)
        .slice(0, 6)
        .map((match) => {
          const face = slugToFace(match.id, peopleMap);
          if (!face) return null;
          return { ...face, score: match.score };
        })
        .filter((f): f is SimilarPerson => f !== null);

      return { similar, debug };
    } catch (err) {
      debug.error = err instanceof Error ? err.message : String(err);
      return { similar: [], debug };
    }
  });

type EnrichItemsInput = {
  items: Array<{ item: string; tags: string[] }>;
};

type EnrichItemResult = {
  item: string;
  itemType: string | null;
  description: string | null;
  itemUrl: string | null;
  error?: string;
};

export const $enrichItems = createServerFn({ method: 'POST' })
  .inputValidator((input: EnrichItemsInput) => input)
  .handler(async ({ data }): Promise<EnrichItemResult[]> => {
    const apiKey = (process.env.OPENAI_API_KEY || '').trim();
    if (!apiKey) {
      return data.items.map((i) => ({
        item: i.item,
        itemType: null,
        description: null,
        itemUrl: null,
        error: 'OPENAI_API_KEY not configured',
      }));
    }

    const OpenAI = (await import('openai')).default;
    const { z } = await import('zod');
    const { zodResponseFormat } = await import('openai/helpers/zod');

    const client = new OpenAI({ apiKey });

    const EnrichedItem = z.object({
      item: z.string(),
      itemType: z.enum(['product', 'service', 'software', 'other']),
      description: z.string().describe('A short 1-sentence description of what this item is'),
      itemUrl: z.string().nullable().describe('The canonical URL where this item can be found. Use null if unsure.'),
    });
    const EnrichmentResult = z.object({ items: z.array(EnrichedItem) });

    const itemList = data.items
      .map((i) => `- ${i.item} (tags: ${i.tags.join(', ')})`)
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
          { role: 'user', content: `Classify and describe these items:\n${itemList}` },
        ],
        response_format: zodResponseFormat(EnrichmentResult, 'enrichment'),
      });

      const parsed = completion.choices[0]?.message?.parsed;
      if (!parsed) {
        return data.items.map((i) => ({
          item: i.item, itemType: null, description: null, itemUrl: null, error: 'Failed to parse response',
        }));
      }

      const resultMap = new Map(parsed.items.map((i) => [i.item, i]));
      const results: EnrichItemResult[] = [];

      for (const input of data.items) {
        const enriched = resultMap.get(input.item);
        const itemSlug = slugify(input.item) || 'item';

        if (enriched) {
          await upsertItemEnrichment(itemSlug, input.item, {
            itemType: enriched.itemType,
            description: enriched.description,
            itemUrl: enriched.itemUrl,
          });
          results.push({
            item: input.item,
            itemType: enriched.itemType,
            description: enriched.description,
            itemUrl: enriched.itemUrl,
          });
        } else {
          results.push({
            item: input.item, itemType: null, description: null, itemUrl: null, error: 'Item not in response',
          });
        }
      }

      return results;
    } catch (err) {
      return data.items.map((i) => ({
        item: i.item,
        itemType: null,
        description: null,
        itemUrl: null,
        error: err instanceof Error ? err.message : 'Enrichment failed',
      }));
    }
  });

export type GalaxyPoint = {
  personSlug: string;
  x: number;
  y: number;
  cluster: number;
};

export type ClusterInfo = {
  id: number;
  label: string;
  topItems: string[];
  count: number;
};

export type GalaxyData = {
  points: GalaxyPoint[];
  clusters: ClusterInfo[];
};

function labelCluster(
  clusterIdx: number,
  memberSlugs: string[],
  itemsByPerson: Map<string, string[]>,
): { label: string; topItems: string[] } {
  const itemCounts = new Map<string, number>();
  for (const slug of memberSlugs) {
    for (const item of itemsByPerson.get(slug) ?? []) {
      itemCounts.set(item, (itemCounts.get(item) || 0) + 1);
    }
  }
  const sorted = [...itemCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([item]) => item);
  const topItems = sorted.slice(0, 8);
  const label = topItems.slice(0, 3).join(', ') || `Cluster ${clusterIdx + 1}`;
  return { label, topItems };
}

export const $getGalaxyData = createServerFn({ method: 'GET' }).handler(
  async (): Promise<GalaxyData> => {
    const vectorize = resolveVectorize();
    if (!vectorize) return { points: [], clusters: [] };

    const scrapedSlugs = await getAllScrapedPersonSlugs();
    if (scrapedSlugs.length < 5) return { points: [], clusters: [] };

    const batchSize = 20;
    const allVectors: VectorizeVector[] = [];
    for (let i = 0; i < scrapedSlugs.length; i += batchSize) {
      const batch = scrapedSlugs.slice(i, i + batchSize);
      const vectors = await vectorize.getByIds(batch);
      allVectors.push(...vectors.filter((v) => v.values?.length > 0));
    }

    if (allVectors.length < 5) return { points: [], clusters: [] };

    const slugs = allVectors.map((v) => v.id);
    const embeddings = allVectors.map((v) => v.values);

    const { UMAP } = await import('umap-js');
    const { kmeans } = await import('ml-kmeans');

    const nNeighbors = Math.max(2, Math.min(15, Math.floor(embeddings.length / 2)));
    const umap = new UMAP({
      nComponents: 2,
      nNeighbors,
      minDist: 0.1,
      spread: 1.0,
    });
    const positions = umap.fit(embeddings);

    const numClusters = Math.min(12, Math.floor(embeddings.length / 3));
    const kResult = kmeans(embeddings, Math.max(2, numClusters), { initialization: 'kmeans++' });

    const itemsByPerson = await getItemsByPerson();

    const points: GalaxyPoint[] = slugs.map((slug, i) => ({
      personSlug: slug,
      x: positions[i][0],
      y: positions[i][1],
      cluster: kResult.clusters[i],
    }));

    const clusterMembers = new Map<number, string[]>();
    for (const point of points) {
      if (!clusterMembers.has(point.cluster)) clusterMembers.set(point.cluster, []);
      clusterMembers.get(point.cluster)!.push(point.personSlug);
    }

    const clusters: ClusterInfo[] = [...clusterMembers.entries()]
      .map(([id, members]) => {
        const { label, topItems } = labelCluster(id, members, itemsByPerson);
        return { id, label, topItems, count: members.length };
      })
      .sort((a, b) => b.count - a.count);

    return { points, clusters };
  },
);
