import { eq, sql } from 'drizzle-orm';
import * as schema from '../schema';
import { resolveDb } from './connection.server';

export type ItemVector = {
  itemSlug: string;
  itemName: string;
  embedding: number[];
};

export async function upsertItemVector(
  itemSlug: string,
  itemName: string,
  embedding: number[],
): Promise<void> {
  const db = resolveDb();
  if (!db) return;

  const now = new Date().toISOString();
  await db
    .insert(schema.itemVectors)
    .values({
      itemSlug,
      itemName,
      embedding: JSON.stringify(embedding),
      embeddedAt: now,
    })
    .onConflictDoUpdate({
      target: schema.itemVectors.itemSlug,
      set: {
        itemName,
        embedding: JSON.stringify(embedding),
        embeddedAt: now,
      },
    });
}

export async function getAllItemVectors(): Promise<ItemVector[]> {
  const db = resolveDb();
  if (!db) return [];

  try {
    const rows = await db
      .select({
        itemSlug: schema.itemVectors.itemSlug,
        itemName: schema.itemVectors.itemName,
        embedding: schema.itemVectors.embedding,
      })
      .from(schema.itemVectors);

    return rows.map((row) => ({
      itemSlug: row.itemSlug,
      itemName: row.itemName,
      embedding: JSON.parse(row.embedding) as number[],
    }));
  } catch (err) {
    console.log('[itemVectors] query failed:', err);
    return [];
  }
}

export async function getItemVectorCount(): Promise<number> {
  const db = resolveDb();
  if (!db) return 0;

  try {
    const rows = await db
      .select({ count: sql<number>`COUNT(*)` })
      .from(schema.itemVectors);
    return rows[0]?.count ?? 0;
  } catch (err) {
    console.log('[itemVectors] count query failed:', err);
    return 0;
  }
}

export async function getItemVectorSlugs(): Promise<Set<string>> {
  const db = resolveDb();
  if (!db) return new Set();

  try {
    const rows = await db
      .select({ itemSlug: schema.itemVectors.itemSlug })
      .from(schema.itemVectors);
    return new Set(rows.map((r) => r.itemSlug));
  } catch (err) {
    console.log('[itemVectors] slugs query failed:', err);
    return new Set();
  }
}
