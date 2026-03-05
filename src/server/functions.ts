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
} from './d1';
import { scrapeUsesPage } from './scrape';

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

type Face = { name: string; avatarUrl: string };

export type TagItemWithFaces = {
  item: string;
  count: number;
  faces: Face[];
};

export type TagSummaryWithFaces = Omit<TagSummary, 'topItems'> & {
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
  return { name: person.name, avatarUrl };
}

export const $getTagSummaries = createServerFn({ method: 'GET' }).handler(
  async (): Promise<TagSummaryWithFaces[]> => {
    const tags = await getAllTagSummaries();
    const allPeople = getAllPeople();
    const peopleMap = new Map(allPeople.map((p) => [p.personSlug, p]));

    return tags.map((tag) => ({
      ...tag,
      topItems: tag.topItems.map((ti) => ({
        item: ti.item,
        count: ti.count,
        faces: ti.personSlugs
          .map((slug) => slugToFace(slug, peopleMap))
          .filter((f): f is Face => f !== null),
      })),
    }));
  }
);
