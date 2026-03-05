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
};

function mapItemDetailWithFaces(detail: ItemDetail): Omit<ItemDetailWithFaces, 'amazon'> {
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
  .handler(async ({ data: itemSlug }): Promise<string | null> => {
    const detail =
      (await getItemDetailBySlug(itemSlug)) ||
      (await getItemDetailByName(itemSlug.replaceAll('-', ' ')));
    if (!detail) return null;

    const [mappedDetail, amazon] = await Promise.all([
      Promise.resolve(mapItemDetailWithFaces(detail)),
      searchAmazonProducts(detail.item),
    ]);

    const payload = {
      ...mappedDetail,
      amazon,
    } as ItemDetailWithFaces;

    return JSON.stringify(payload);
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
    return searchItems(data);
  });

type MergeItemsInput = {
  canonicalItem: string;
  sourceItems: string[];
};

export const $mergeItems = createServerFn({ method: 'POST' })
  .inputValidator((input: MergeItemsInput) => input)
  .handler(async ({ data }) => {
    return mergeItemsIntoCanonical(data.canonicalItem, data.sourceItems);
  });
