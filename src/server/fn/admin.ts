import { createServerFn } from '@tanstack/react-start';
import type OpenAI from 'openai';
import {
  getExtractedTags,
  getPersonScrapeHistory,
  getRandomScrapedPages,
  getRecentScrapeEvents,
  getScrapeHistoryStats,
  type ScrapeHistoryStats,
  type ScrapeEventRow,
  type PersonScrapeHistoryRow,
} from '../db/index.server';
import { getAnalyticsDashboardData, writeViewEvent, type ViewEntityType } from '../analytics';
import { createOpenAIClient, extractItemsFromMarkdown, normalizeItems } from '../extract';
import { mapConcurrent, BATCH_CONCURRENCY } from './helpers';

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
  scrapeStats: ScrapeHistoryStats;
  recentScrapeEvents: ScrapeEventRow[];
  personScrapeHistory: PersonScrapeHistoryRow[];
  analytics: Awaited<ReturnType<typeof getAnalyticsDashboardData>>;
  tags: string[];
};

export const $getAdminDashboardData = createServerFn({ method: 'GET' }).handler(
  async (): Promise<AdminDashboardData> => {
    const [scrapeStats, recentScrapeEvents, personScrapeHistory, analytics, tags] =
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
        getExtractedTags().catch(() => []),
      ]);

    return {
      scrapeStats,
      recentScrapeEvents,
      personScrapeHistory,
      analytics,
      tags,
    };
  }
);

type DiscoverTagsInput = {
  sampleSize: number;
};

export type DiscoverTagsResult = {
  sampledPages: number;
  totalItems: number;
  topTags: Array<{ tag: string; count: number }>;
  topItems: Array<{ item: string; count: number }>;
  errors: number;
};

export const $discoverTags = createServerFn({ method: 'POST' })
  .inputValidator((input: DiscoverTagsInput) => input)
  .handler(async ({ data }): Promise<DiscoverTagsResult> => {
    const pages = await getRandomScrapedPages(data.sampleSize);

    if (pages.length === 0) {
      return { sampledPages: 0, totalItems: 0, topTags: [], topItems: [], errors: 0 };
    }

    let client: OpenAI;
    try {
      client = createOpenAIClient();
    } catch {
      return { sampledPages: 0, totalItems: 0, topTags: [], topItems: [], errors: 0 };
    }

    const allItems: Array<{ item: string; tags: string[] }> = [];
    let errors = 0;

    await mapConcurrent(pages, BATCH_CONCURRENCY, async (page) => {
      try {
        const extraction = await extractItemsFromMarkdown(client, page.contentMarkdown);
        const normalized = normalizeItems(extraction.items);
        for (const item of normalized) {
          allItems.push({ item: item.item, tags: item.tags });
        }
      } catch {
        errors++;
      }
    });

    const tagCounts = new Map<string, number>();
    const itemCounts = new Map<string, number>();

    for (const item of allItems) {
      const normalizedItem = item.item.toLowerCase().trim();
      itemCounts.set(normalizedItem, (itemCounts.get(normalizedItem) || 0) + 1);
      for (const tag of item.tags) {
        const t = tag.toLowerCase().trim();
        tagCounts.set(t, (tagCounts.get(t) || 0) + 1);
      }
    }

    const topTags = [...tagCounts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 50)
      .map(([tag, count]) => ({ tag, count }));

    const topItems = [...itemCounts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 50)
      .map(([item, count]) => ({ item, count }));

    return {
      sampledPages: pages.length,
      totalItems: allItems.length,
      topTags,
      topItems,
      errors,
    };
  });
