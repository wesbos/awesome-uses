import { eq, sql, desc } from 'drizzle-orm';
import type { ScrapedProfileData, ScrapeStatusRow } from '../../lib/types';
import type { ScrapePageResult } from '../scrape';
import * as schema from '../schema';
import { resolveDb } from './connection.server';

export async function getScrapedProfileBySlug(
  personSlug: string,
): Promise<ScrapedProfileData | null> {
  const db = resolveDb();
  if (!db) return null;

  const row = await db
    .select({
      personSlug: schema.personPages.personSlug,
      url: schema.personPages.url,
      statusCode: schema.personPages.statusCode,
      fetchedAt: schema.personPages.fetchedAt,
      title: schema.personPages.title,
      contentMarkdown: schema.personPages.contentMarkdown,
    })
    .from(schema.personPages)
    .where(eq(schema.personPages.personSlug, personSlug))
    .limit(1)
    .then((rows) => rows[0] ?? null);

  return row;
}

export async function getAllScrapeSummaries(): Promise<ScrapeStatusRow[]> {
  const db = resolveDb();
  if (!db) return [];

  return db
    .select({
      personSlug: schema.personPages.personSlug,
      url: schema.personPages.url,
      statusCode: schema.personPages.statusCode,
      fetchedAt: schema.personPages.fetchedAt,
      title: schema.personPages.title,
      vectorizedAt: schema.personPages.vectorizedAt,
    })
    .from(schema.personPages)
    .orderBy(desc(schema.personPages.fetchedAt));
}

export async function upsertScrapedProfile(
  personSlug: string,
  url: string,
  fetchedAt: string,
  scraped: ScrapePageResult,
): Promise<void> {
  const db = resolveDb();
  if (!db) return;

  const previous = await db
    .select({ contentHash: schema.personPages.contentHash })
    .from(schema.personPages)
    .where(eq(schema.personPages.personSlug, personSlug))
    .limit(1)
    .then((rows) => rows[0] ?? null);

  await db
    .insert(schema.personPages)
    .values({
      personSlug,
      url,
      statusCode: scraped.statusCode,
      fetchedAt,
      title: scraped.title,
      contentMarkdown: scraped.contentMarkdown,
      contentHash: scraped.contentHash,
    })
    .onConflictDoUpdate({
      target: schema.personPages.personSlug,
      set: {
        url,
        statusCode: scraped.statusCode,
        fetchedAt,
        title: scraped.title,
        contentMarkdown: scraped.contentMarkdown,
        contentHash: scraped.contentHash,
      },
    });

  const changeType = classifyScrapeChangeType(previous, scraped);

  try {
    await db
      .insert(schema.personPageEvents)
      .values({
        personSlug,
        url,
        statusCode: scraped.statusCode,
        fetchedAt,
        contentHash: scraped.contentHash,
        changeType,
        title: scraped.title,
      });
  } catch {
    // no-op: avoid failing scrape writes when migrations are not yet applied
  }
}

type ExistingScrapeSnapshot = {
  contentHash: string | null;
};

export type ScrapeChangeType =
  | 'initial'
  | 'updated'
  | 'unchanged'
  | 'error'
  | 'non_html';

function classifyScrapeChangeType(
  previous: ExistingScrapeSnapshot | null,
  scraped: ScrapePageResult,
): ScrapeChangeType {
  if (scraped.statusCode === null || scraped.statusCode >= 400) {
    return 'error';
  }

  if (!scraped.contentMarkdown) {
    return 'non_html';
  }

  if (!previous) {
    return 'initial';
  }

  if (previous.contentHash !== scraped.contentHash) {
    return 'updated';
  }

  return 'unchanged';
}

export async function getScrapedContent(personSlug: string): Promise<{
  contentMarkdown: string | null;
  contentHash: string | null;
} | null> {
  const db = resolveDb();
  if (!db) return null;

  return db
    .select({
      contentMarkdown: schema.personPages.contentMarkdown,
      contentHash: schema.personPages.contentHash,
    })
    .from(schema.personPages)
    .where(eq(schema.personPages.personSlug, personSlug))
    .limit(1)
    .then((rows) => rows[0] ?? null);
}

export async function getErrorPeople(): Promise<Array<{
  personSlug: string;
  url: string;
  statusCode: number | null;
  fetchedAt: string;
  title: string | null;
}>> {
  const db = resolveDb();
  if (!db) return [];

  try {
    return await db
      .select({
        personSlug: schema.personPages.personSlug,
        url: schema.personPages.url,
        statusCode: schema.personPages.statusCode,
        fetchedAt: schema.personPages.fetchedAt,
        title: schema.personPages.title,
      })
      .from(schema.personPages)
      .where(
        sql`${schema.personPages.statusCode} IS NULL OR ${schema.personPages.statusCode} >= 400`
      )
      .orderBy(desc(schema.personPages.fetchedAt));
  } catch {
    return [];
  }
}

export async function getAllScrapedPersonSlugs(): Promise<string[]> {
  const db = resolveDb();
  if (!db) return [];
  try {
    const rows = await db
      .select({ personSlug: schema.personPages.personSlug })
      .from(schema.personPages);
    return rows.map((r) => r.personSlug);
  } catch {
    return [];
  }
}

export async function markVectorized(personSlug: string): Promise<void> {
  const db = resolveDb();
  if (!db) return;
  await db
    .update(schema.personPages)
    .set({ vectorizedAt: new Date().toISOString() })
    .where(eq(schema.personPages.personSlug, personSlug));
}

export type ScrapedPageForExtraction = {
  personSlug: string;
  contentMarkdown: string;
};

export async function getScrapedPagesForExtraction(
  options: { skipExisting: boolean; limit: number },
): Promise<ScrapedPageForExtraction[]> {
  const db = resolveDb();
  if (!db) return [];

  const safeLimit = Math.max(1, Math.min(options.limit, 2000));

  try {
    if (options.skipExisting) {
      return await db.all<ScrapedPageForExtraction>(
        sql`SELECT person_slug AS personSlug, content_markdown AS contentMarkdown
            FROM person_pages
            WHERE content_markdown IS NOT NULL AND content_markdown != ''
              AND person_slug NOT IN (SELECT DISTINCT person_slug FROM person_items)
            ORDER BY person_slug
            LIMIT ${safeLimit}`,
      );
    }

    return await db.all<ScrapedPageForExtraction>(
      sql`SELECT person_slug AS personSlug, content_markdown AS contentMarkdown
          FROM person_pages
          WHERE content_markdown IS NOT NULL AND content_markdown != ''
          ORDER BY person_slug
          LIMIT ${safeLimit}`,
    );
  } catch {
    return [];
  }
}

export async function getRandomScrapedPages(
  sampleSize: number,
): Promise<ScrapedPageForExtraction[]> {
  const db = resolveDb();
  if (!db) return [];

  const safeLimit = Math.max(1, Math.min(sampleSize, 500));

  try {
    return await db.all<ScrapedPageForExtraction>(
      sql`SELECT person_slug AS personSlug, content_markdown AS contentMarkdown
          FROM person_pages
          WHERE content_markdown IS NOT NULL AND content_markdown != ''
          ORDER BY RANDOM()
          LIMIT ${safeLimit}`,
    );
  } catch {
    return [];
  }
}

export type ProfileForVectorization = {
  personSlug: string;
  contentMarkdown: string;
};

export async function getProfilesForVectorization(
  options: { skipExisting: boolean; limit: number },
): Promise<ProfileForVectorization[]> {
  const db = resolveDb();
  if (!db) return [];

  const safeLimit = Math.max(1, Math.min(options.limit, 2000));

  try {
    if (options.skipExisting) {
      return await db.all<ProfileForVectorization>(
        sql`SELECT person_slug AS personSlug, content_markdown AS contentMarkdown
            FROM person_pages
            WHERE content_markdown IS NOT NULL AND length(content_markdown) > 100
              AND vectorized_at IS NULL
            ORDER BY person_slug
            LIMIT ${safeLimit}`,
      );
    }

    return await db.all<ProfileForVectorization>(
      sql`SELECT person_slug AS personSlug, content_markdown AS contentMarkdown
          FROM person_pages
          WHERE content_markdown IS NOT NULL AND length(content_markdown) > 100
          ORDER BY person_slug
          LIMIT ${safeLimit}`,
    );
  } catch {
    return [];
  }
}
