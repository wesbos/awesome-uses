import { sql } from 'drizzle-orm';
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

  await db.run(sql`
    INSERT INTO item_vectors (item_slug, item_name, embedding, embedded_at)
    VALUES (${itemSlug}, ${itemName}, ${JSON.stringify(embedding)}, ${new Date().toISOString()})
    ON CONFLICT(item_slug) DO UPDATE SET
      item_name = ${itemName},
      embedding = ${JSON.stringify(embedding)},
      embedded_at = ${new Date().toISOString()}
  `);
}

export async function getAllItemVectors(): Promise<ItemVector[]> {
  const db = resolveDb();
  if (!db) return [];

  try {
    const rows = await db.all<{ item_slug: string; item_name: string; embedding: string }>(
      sql`SELECT item_slug, item_name, embedding FROM item_vectors`,
    );
    return rows.map((row) => ({
      itemSlug: row.item_slug,
      itemName: row.item_name,
      embedding: JSON.parse(row.embedding) as number[],
    }));
  } catch {
    return [];
  }
}

export async function getItemVectorCount(): Promise<number> {
  const db = resolveDb();
  if (!db) return 0;

  try {
    const rows = await db.all<{ count: number }>(
      sql`SELECT COUNT(*) as count FROM item_vectors`,
    );
    return rows[0]?.count ?? 0;
  } catch {
    return 0;
  }
}

export async function getItemVectorSlugs(): Promise<Set<string>> {
  const db = resolveDb();
  if (!db) return new Set();

  try {
    const rows = await db.all<{ item_slug: string }>(
      sql`SELECT item_slug FROM item_vectors`,
    );
    return new Set(rows.map((r) => r.item_slug));
  } catch {
    return new Set();
  }
}
