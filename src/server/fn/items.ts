import { createServerFn } from '@tanstack/react-start';
import { z } from 'zod';
import { zodResponseFormat } from 'openai/helpers/zod';
import type OpenAI from 'openai';
import { getAllPeople } from '../../lib/data';
import { slugify } from '../../lib/slug';
import type { AmazonProductSearchResult } from '../amazon';
import { searchAmazonProducts } from '../amazon';
import {
  findDuplicateItems,
  getAllItemEnrichments,
  getAllUniqueItems,
  getExtractionReviewData,
  getItemDetailByName,
  getItemDetailBySlug,
  getItemEnrichment,
  mergeItemsIntoCanonical,
  searchItems,
  upsertItemEnrichment,
  type DuplicateGroup,
  type ExtractionReviewData,
} from '../db/index.server';
import { createOpenAIClient } from '../extract';
import { BANNED_TAGS } from '../extract';
import { mapItemDetailWithFaces, slugToFace, type Face, type BaseItemDetail, type TagItemWithFaces } from './helpers';

export type ItemDetailWithFaces = BaseItemDetail & {
  amazon: AmazonProductSearchResult;
  itemType: string | null;
  description: string | null;
  itemUrl: string | null;
};

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

export { type DuplicateGroup };

export const $findDuplicateItems = createServerFn({ method: 'GET' }).handler(
  async (): Promise<DuplicateGroup[]> => {
    return findDuplicateItems();
  },
);

export { type ExtractionReviewData };

export const $getExtractionReview = createServerFn({ method: 'GET' }).handler(
  async (): Promise<ExtractionReviewData> => {
    return getExtractionReviewData(BANNED_TAGS);
  },
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

const EnrichedItemSchema = z.object({
  item: z.string(),
  itemType: z.enum(['product', 'service', 'software', 'other']),
  description: z.string().describe('A short 1-sentence description of what this item is'),
  itemUrl: z.string().nullable().describe('The canonical URL where this item can be found. Use null if unsure.'),
});
const EnrichmentResultSchema = z.object({ items: z.array(EnrichedItemSchema) });

export type FeaturedItemRow = {
  itemSlug: string;
  itemName: string;
  itemType: string;
  description: string | null;
  itemUrl: string | null;
  count: number;
  faces: Face[];
};

export type FeaturedItemsByType = {
  product: FeaturedItemRow[];
  software: FeaturedItemRow[];
  service: FeaturedItemRow[];
};

export const $getFeaturedItems = createServerFn({ method: 'GET' }).handler(
  async (): Promise<FeaturedItemsByType> => {
    const [uniqueItems, enrichments] = await Promise.all([
      getAllUniqueItems(),
      getAllItemEnrichments(),
    ]);

    const enrichmentMap = new Map(enrichments.map((e) => [e.itemSlug, e]));
    const allPeople = getAllPeople();
    const peopleMap = new Map(allPeople.map((p) => [p.personSlug, p]));

    const typed = uniqueItems
      .map((item) => {
        const itemSlugVal = slugify(item.item) || 'item';
        const enrichment = enrichmentMap.get(itemSlugVal);
        if (!enrichment?.itemType || enrichment.itemType === 'other') return null;
        return {
          itemSlug: itemSlugVal,
          itemName: enrichment.itemName,
          itemType: enrichment.itemType,
          description: enrichment.description,
          itemUrl: enrichment.itemUrl,
          count: item.count,
          tags: item.tags,
        };
      })
      .filter((r): r is NonNullable<typeof r> => r !== null);

    function topByType(type: string): FeaturedItemRow[] {
      return typed
        .filter((r) => r.itemType === type)
        .slice(0, 8)
        .map((r) => ({
          itemSlug: r.itemSlug,
          itemName: r.itemName,
          itemType: r.itemType,
          description: r.description,
          itemUrl: r.itemUrl,
          count: r.count,
          faces: [],
        }));
    }

    return {
      product: topByType('product'),
      software: topByType('software'),
      service: topByType('service'),
    };
  },
);

export const $enrichItems = createServerFn({ method: 'POST' })
  .inputValidator((input: EnrichItemsInput) => input)
  .handler(async ({ data }): Promise<EnrichItemResult[]> => {
    let client: OpenAI;
    try {
      client = createOpenAIClient();
    } catch {
      return data.items.map((i) => ({
        item: i.item,
        itemType: null,
        description: null,
        itemUrl: null,
        error: 'OPENAI_API_KEY not configured',
      }));
    }

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
        response_format: zodResponseFormat(EnrichmentResultSchema, 'enrichment'),
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
