import { sql } from 'drizzle-orm';
import * as schema from '../schema';
import { resolveDb } from './connection.server';

export type TagVector = {
  tagSlug: string;
  tagName: string;
  embedding: number[];
};

export async function upsertTagVector(
  tagSlug: string,
  tagName: string,
  embedding: number[],
): Promise<void> {
  const db = resolveDb();
  if (!db) return;

  const now = new Date().toISOString();
  await db
    .insert(schema.tagVectors)
    .values({
      tagSlug,
      tagName,
      embedding: JSON.stringify(embedding),
      embeddedAt: now,
    })
    .onConflictDoUpdate({
      target: schema.tagVectors.tagSlug,
      set: {
        tagName,
        embedding: JSON.stringify(embedding),
        embeddedAt: now,
      },
    });
}

export async function getAllTagVectors(): Promise<TagVector[]> {
  const db = resolveDb();
  if (!db) return [];

  try {
    const rows = await db
      .select({
        tagSlug: schema.tagVectors.tagSlug,
        tagName: schema.tagVectors.tagName,
        embedding: schema.tagVectors.embedding,
      })
      .from(schema.tagVectors);

    return rows.map((row) => ({
      tagSlug: row.tagSlug,
      tagName: row.tagName,
      embedding: JSON.parse(row.embedding) as number[],
    }));
  } catch (err) {
    console.log('[tagVectors] query failed:', err);
    return [];
  }
}

export async function getTagVectorSlugs(): Promise<Set<string>> {
  const db = resolveDb();
  if (!db) return new Set();

  try {
    const rows = await db
      .select({ tagSlug: schema.tagVectors.tagSlug })
      .from(schema.tagVectors);
    return new Set(rows.map((r) => r.tagSlug));
  } catch (err) {
    console.log('[tagVectors] slugs query failed:', err);
    return new Set();
  }
}
