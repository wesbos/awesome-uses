import { eq } from 'drizzle-orm';
import * as schema from '../schema';
import { resolveDb } from './connection.server';
import type { AwardKey, AnyAward } from '../awards/types';

export async function getAllAwards(): Promise<AnyAward[]> {
  const db = resolveDb();
  if (!db) return [];

  try {
    const rows = await db.select().from(schema.awards);
    return rows.map((row) => ({
      awardKey: row.awardKey as AwardKey,
      title: row.title,
      description: row.description,
      data: JSON.parse(row.dataJson),
      calculatedAt: row.calculatedAt,
    }));
  } catch (error) {
    console.log('[awards] Failed to fetch awards:', error);
    return [];
  }
}

export async function getAwardByKey(awardKey: AwardKey): Promise<AnyAward | null> {
  const db = resolveDb();
  if (!db) return null;

  try {
    const row = await db
      .select()
      .from(schema.awards)
      .where(eq(schema.awards.awardKey, awardKey))
      .limit(1)
      .then((rows) => rows[0] ?? null);

    if (!row) return null;

    return {
      awardKey: row.awardKey as AwardKey,
      title: row.title,
      description: row.description,
      data: JSON.parse(row.dataJson),
      calculatedAt: row.calculatedAt,
    };
  } catch (error) {
    console.log(`[awards] Failed to fetch award ${awardKey}:`, error);
    return null;
  }
}

export async function upsertAward(
  awardKey: AwardKey,
  title: string,
  description: string,
  data: unknown,
): Promise<void> {
  const db = resolveDb();
  if (!db) return;

  const now = new Date().toISOString();
  const dataJson = JSON.stringify(data);

  await db
    .insert(schema.awards)
    .values({
      awardKey,
      title,
      description,
      dataJson,
      calculatedAt: now,
    })
    .onConflictDoUpdate({
      target: schema.awards.awardKey,
      set: {
        title,
        description,
        dataJson,
        calculatedAt: now,
      },
    });
}
