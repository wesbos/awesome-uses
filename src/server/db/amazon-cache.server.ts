import { eq, and, gt } from 'drizzle-orm';
import * as schema from '../schema';
import { resolveDb } from './connection.server';

export type AmazonCacheRow = {
  itemKey: string;
  query: string;
  marketplace: string;
  payloadJson: string;
  fetchedAt: string;
  expiresAt: string;
};

export async function getAmazonCacheByItemKey(
  itemKey: string,
  marketplace: string,
): Promise<AmazonCacheRow | null> {
  const db = resolveDb();
  if (!db) return null;

  const row = await db
    .select({
      itemKey: schema.amazonItemCache.itemKey,
      query: schema.amazonItemCache.query,
      marketplace: schema.amazonItemCache.marketplace,
      payloadJson: schema.amazonItemCache.payloadJson,
      fetchedAt: schema.amazonItemCache.fetchedAt,
      expiresAt: schema.amazonItemCache.expiresAt,
    })
    .from(schema.amazonItemCache)
    .where(
      and(
        eq(schema.amazonItemCache.itemKey, itemKey),
        eq(schema.amazonItemCache.marketplace, marketplace),
        gt(schema.amazonItemCache.expiresAt, new Date().toISOString()),
      )
    )
    .limit(1)
    .then((rows) => rows[0] ?? null);

  return row;
}

export async function upsertAmazonCache(
  itemKey: string,
  query: string,
  marketplace: string,
  payloadJson: string,
  expiresAt: string,
): Promise<void> {
  const db = resolveDb();
  if (!db) return;

  const fetchedAt = new Date().toISOString();
  await db
    .insert(schema.amazonItemCache)
    .values({ itemKey, query, marketplace, payloadJson, fetchedAt, expiresAt })
    .onConflictDoUpdate({
      target: schema.amazonItemCache.itemKey,
      set: {
        query,
        marketplace,
        payloadJson,
        fetchedAt,
        expiresAt,
      },
    });
}
