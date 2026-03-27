import type { DrizzleD1Database } from 'drizzle-orm/d1';
import type * as schemaImport from '../../schema';
import { sql } from 'drizzle-orm';
import { slugify } from '../../../lib/slug';
import type { AwardDataMap } from '../types';

export async function calculateMostPopularProduct(
  db: DrizzleD1Database<typeof schemaImport>,
): Promise<AwardDataMap['most-popular-product']> {
  const rows = await db.all<{ item: string; count: number }>(
    sql`SELECT item, COUNT(DISTINCT person_slug) as count
        FROM person_items
        GROUP BY item
        ORDER BY count DESC
        LIMIT 11`,
  );

  const winner = rows[0];
  if (!winner) {
    return { item: '', itemSlug: '', count: 0, runnersUp: [] };
  }

  return {
    item: winner.item,
    itemSlug: slugify(winner.item),
    count: winner.count,
    runnersUp: rows.slice(1, 6).map((r) => ({
      item: r.item,
      itemSlug: slugify(r.item),
      count: r.count,
    })),
  };
}
