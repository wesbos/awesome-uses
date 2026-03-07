import { eq } from 'drizzle-orm';
import * as schema from '../schema';
import { resolveDb } from './connection.server';

export async function getItemEnrichment(itemSlug: string): Promise<{
  itemType: string | null;
  description: string | null;
  itemUrl: string | null;
  enrichedAt: string | null;
} | null> {
  const db = resolveDb();
  if (!db) return null;

  return db
    .select({
      itemType: schema.items.itemType,
      description: schema.items.description,
      itemUrl: schema.items.itemUrl,
      enrichedAt: schema.items.enrichedAt,
    })
    .from(schema.items)
    .where(eq(schema.items.itemSlug, itemSlug))
    .limit(1)
    .then((rows) => rows[0] ?? null);
}

export async function upsertItemEnrichment(
  itemSlug: string,
  itemName: string,
  data: { itemType?: string | null; description?: string | null; itemUrl?: string | null },
): Promise<void> {
  const db = resolveDb();
  if (!db) return;

  await db
    .insert(schema.items)
    .values({
      itemSlug,
      itemName,
      itemType: data.itemType ?? null,
      description: data.description ?? null,
      itemUrl: data.itemUrl ?? null,
      enrichedAt: new Date().toISOString(),
    })
    .onConflictDoUpdate({
      target: schema.items.itemSlug,
      set: {
        itemName,
        itemType: data.itemType ?? null,
        description: data.description ?? null,
        itemUrl: data.itemUrl ?? null,
        enrichedAt: new Date().toISOString(),
      },
    });
}

export async function getAllItemEnrichments(): Promise<Array<{
  itemSlug: string;
  itemName: string;
  itemType: string | null;
  description: string | null;
  itemUrl: string | null;
  enrichedAt: string | null;
}>> {
  const db = resolveDb();
  if (!db) return [];

  try {
    return await db
      .select()
      .from(schema.items);
  } catch {
    return [];
  }
}
