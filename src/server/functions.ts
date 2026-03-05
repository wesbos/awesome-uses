import { createServerFn } from '@tanstack/react-start';
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
  type ReclassifyAssignment,
  type ItemDetail,
  type TagDetail,
} from './d1';
import { scrapeUsesPage } from './scrape';
import { searchAmazonProducts, type AmazonProductSearchResult } from './amazon';
import {
  getAnalyticsDashboardData,
  writeViewEvent,
  type ViewEntityType,
} from './analytics';
import { previewTagReclassification } from './reclassify';
import { slugify } from '../lib/slug';

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
};

export type DashboardPayload = {
  total: number;
  scraped: number;
  rows: DashboardRow[];
};

export const $getScrapeStatus = createServerFn({ method: 'GET' }).handler(
  async (): Promise<DashboardPayload> => {
    const [scrapes, people] = await Promise.all([
      getAllScrapeSummaries(),
      Promise.resolve(getAllPeople()),
    ]);

    const scrapeMap = new Map(scrapes.map((s) => [s.personSlug, s]));

    const rows: DashboardRow[] = people.map((person) => {
      const scrape = scrapeMap.get(person.personSlug);
      return {
        personSlug: person.personSlug,
        name: person.name,
        url: person.url,
        statusCode: scrape?.statusCode ?? null,
        fetchedAt: scrape?.fetchedAt ?? null,
        title: scrape?.title ?? null,
        scraped: !!scrape,
      };
    });

    return { total: people.length, scraped: scrapes.length, rows };
  }
);

type Face = { personSlug: string; name: string; avatarUrl: string };

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
): Face | null {
  const person = peopleMap.get(slug);
  if (!person) return null;
  const url = new URL(person.url);
  const twitterAvatar = person.twitter
    ? `https://unavatar.io/x/${person.twitter.replace('@', '')}`
    : null;
  const websiteAvatar = `https://unavatar.io/${url.host}`;
  const avatarUrl = twitterAvatar
    ? `${twitterAvatar}?fallback=${websiteAvatar}`
    : websiteAvatar;
  return { personSlug: person.personSlug, name: person.name, avatarUrl };
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
      .map((slug) => slugToFace(slug, peopleMap))
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
      return { personSlug: data.personSlug, scraped: true, contentChanged, extracted: false, itemCount: 0 };
    }

    try {
      const OpenAI = (await import('openai')).default;
      const { z } = await import('zod');
      const { zodResponseFormat } = await import('openai/helpers/zod');

      const apiKey = (process.env.OPENAI_API_KEY || '').trim();
      if (!apiKey) {
        return { personSlug: data.personSlug, scraped: true, contentChanged: true, extracted: false, itemCount: 0, error: 'OPENAI_API_KEY not configured' };
      }

      const client = new OpenAI({ apiKey });

      const ExtractedItem = z.object({
        item: z.string(),
        categories: z.array(z.string()),
        detail: z.string().nullable(),
      });
      const ExtractionResult = z.object({ items: z.array(ExtractedItem) });

      const completion = await client.chat.completions.parse({
        model: 'gpt-5-mini',
        messages: [
          { role: 'system', content: 'You extract tools, products, and gear from developer /uses pages. Return item name, categories, and detail.' },
          { role: 'user', content: scraped.contentMarkdown.slice(0, 15_000) },
        ],
        response_format: zodResponseFormat(ExtractionResult, 'extraction'),
      });

      const parsed = completion.choices[0]?.message?.parsed;
      if (!parsed || parsed.items.length === 0) {
        return { personSlug: data.personSlug, scraped: true, contentChanged: true, extracted: false, itemCount: 0 };
      }

      await deletePersonItems(data.personSlug);

      const extractedAt = new Date().toISOString();
      const rows = parsed.items.map((item) => ({
        personSlug: data.personSlug,
        item: item.item.trim(),
        tagsJson: JSON.stringify(item.categories),
        detail: item.detail,
        extractedAt,
      }));

      await insertPersonItems(rows);

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
