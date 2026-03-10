import { createServerFn } from '@tanstack/react-start';
import { getPersonBySlug, getAllPeople } from '../../lib/data';
import type { PersonItem, ScrapedProfileData } from '../../lib/types';
import {
  deletePersonItems,
  getAllScrapeSummaries,
  getErrorPeople,
  getPersonItems,
  getScrapedContent,
  getScrapedProfileBySlug,
  insertPersonItems,
  upsertScrapedProfile,
} from '../db/index.server';
import { scrapeUsesPage } from '../scrape';
import { createOpenAIClient, extractItemsFromMarkdown, normalizeItems } from '../extract';
import { vectorizeProfile } from './vectorize.server';
import { fetchGitHubStats, type GitHubStats } from '../github';
import { eq } from 'drizzle-orm';
import * as schema from '../schema';
import { resolveDb } from '../db/connection.server';

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
        tagsJson: JSON.stringify(item.tags),
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

const ONE_WEEK_MS = 7 * 24 * 60 * 60 * 1000;

export const $getGitHubStats = createServerFn({ method: 'GET' })
  .inputValidator((personSlug: string) => personSlug)
  .handler(async ({ data: personSlug }): Promise<GitHubStats | null> => {
    const person = getPersonBySlug(personSlug);
    if (!person?.github) return null;

    const db = resolveDb();
    if (db) {
      const cached = await db
        .select()
        .from(schema.githubProfiles)
        .where(eq(schema.githubProfiles.personSlug, personSlug))
        .limit(1)
        .then((rows) => rows[0] ?? null);

      if (cached && new Date(cached.expiresAt) > new Date()) {
        console.log(`[github] Cache hit for ${personSlug}`);
        return JSON.parse(cached.dataJson) as GitHubStats;
      }
    }

    const stats = await fetchGitHubStats(person.github);
    if (!stats) return null;

    if (db) {
      const now = new Date();
      await db
        .insert(schema.githubProfiles)
        .values({
          personSlug,
          githubUsername: person.github,
          dataJson: JSON.stringify(stats),
          fetchedAt: now.toISOString(),
          expiresAt: new Date(now.getTime() + ONE_WEEK_MS).toISOString(),
        })
        .onConflictDoUpdate({
          target: schema.githubProfiles.personSlug,
          set: {
            githubUsername: person.github,
            dataJson: JSON.stringify(stats),
            fetchedAt: now.toISOString(),
            expiresAt: new Date(now.getTime() + ONE_WEEK_MS).toISOString(),
          },
        })
        .run();
      console.log(`[github] Cached ${personSlug} until ${new Date(now.getTime() + ONE_WEEK_MS).toISOString()}`);
    }

    return stats;
  });
