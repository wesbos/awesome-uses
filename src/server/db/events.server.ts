import { desc, sql } from 'drizzle-orm';
import * as schema from '../schema';
import { resolveDb } from './connection.server';
import type { ScrapeChangeType } from './profiles.server';

export type ScrapeEventRow = {
  id: number;
  personSlug: string;
  url: string;
  statusCode: number | null;
  fetchedAt: string;
  contentHash: string | null;
  changeType: ScrapeChangeType;
  title: string | null;
};

export type ScrapeHistoryStats = {
  totalEvents: number;
  initialEvents: number;
  updatedEvents: number;
  unchangedEvents: number;
  errorEvents: number;
  nonHtmlEvents: number;
  peopleUpdated: number;
  lastEventAt: string | null;
};

export type PersonScrapeHistoryRow = {
  personSlug: string;
  scrapeCount: number;
  updateCount: number;
  lastScrapedAt: string | null;
  lastUpdatedAt: string | null;
};

export async function getRecentScrapeEvents(
  limit = 100,
): Promise<ScrapeEventRow[]> {
  const db = resolveDb();
  if (!db) return [];

  const safeLimit = Math.max(1, Math.min(limit, 500));
  try {
    const rows = await db
      .select({
        id: schema.personPageEvents.id,
        personSlug: schema.personPageEvents.personSlug,
        url: schema.personPageEvents.url,
        statusCode: schema.personPageEvents.statusCode,
        fetchedAt: schema.personPageEvents.fetchedAt,
        contentHash: schema.personPageEvents.contentHash,
        changeType: schema.personPageEvents.changeType,
        title: schema.personPageEvents.title,
      })
      .from(schema.personPageEvents)
      .orderBy(desc(schema.personPageEvents.fetchedAt))
      .limit(safeLimit);
    return rows as ScrapeEventRow[];
  } catch {
    return [];
  }
}

export async function getScrapeHistoryStats(): Promise<ScrapeHistoryStats> {
  const db = resolveDb();
  if (!db) {
    return {
      totalEvents: 0,
      initialEvents: 0,
      updatedEvents: 0,
      unchangedEvents: 0,
      errorEvents: 0,
      nonHtmlEvents: 0,
      peopleUpdated: 0,
      lastEventAt: null,
    };
  }

  try {
    const row = await db.get<{
      totalEvents: number | null;
      initialEvents: number | null;
      updatedEvents: number | null;
      unchangedEvents: number | null;
      errorEvents: number | null;
      nonHtmlEvents: number | null;
      peopleUpdated: number | null;
      lastEventAt: string | null;
    }>(
      sql`SELECT
            COUNT(*) as totalEvents,
            SUM(CASE WHEN change_type = 'initial' THEN 1 ELSE 0 END) as initialEvents,
            SUM(CASE WHEN change_type = 'updated' THEN 1 ELSE 0 END) as updatedEvents,
            SUM(CASE WHEN change_type = 'unchanged' THEN 1 ELSE 0 END) as unchangedEvents,
            SUM(CASE WHEN change_type = 'error' THEN 1 ELSE 0 END) as errorEvents,
            SUM(CASE WHEN change_type = 'non_html' THEN 1 ELSE 0 END) as nonHtmlEvents,
            COUNT(DISTINCT CASE WHEN change_type = 'updated' THEN person_slug END) as peopleUpdated,
            MAX(fetched_at) as lastEventAt
          FROM person_page_events`
    );

    return {
      totalEvents: row?.totalEvents ?? 0,
      initialEvents: row?.initialEvents ?? 0,
      updatedEvents: row?.updatedEvents ?? 0,
      unchangedEvents: row?.unchangedEvents ?? 0,
      errorEvents: row?.errorEvents ?? 0,
      nonHtmlEvents: row?.nonHtmlEvents ?? 0,
      peopleUpdated: row?.peopleUpdated ?? 0,
      lastEventAt: row?.lastEventAt ?? null,
    };
  } catch {
    return {
      totalEvents: 0,
      initialEvents: 0,
      updatedEvents: 0,
      unchangedEvents: 0,
      errorEvents: 0,
      nonHtmlEvents: 0,
      peopleUpdated: 0,
      lastEventAt: null,
    };
  }
}

export async function getPersonScrapeHistory(): Promise<PersonScrapeHistoryRow[]> {
  const db = resolveDb();
  if (!db) return [];

  try {
    return await db.all<PersonScrapeHistoryRow>(
      sql`SELECT
            person_slug as personSlug,
            COUNT(*) as scrapeCount,
            SUM(CASE WHEN change_type = 'updated' THEN 1 ELSE 0 END) as updateCount,
            MAX(fetched_at) as lastScrapedAt,
            MAX(CASE WHEN change_type IN ('initial', 'updated') THEN fetched_at END) as lastUpdatedAt
          FROM person_page_events
          GROUP BY person_slug
          ORDER BY lastScrapedAt DESC`
    );
  } catch {
    return [];
  }
}
