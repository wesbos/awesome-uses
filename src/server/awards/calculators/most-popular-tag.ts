import type { DrizzleD1Database } from 'drizzle-orm/d1';
import type * as schemaImport from '../../schema';
import { getAllTags } from '../../../lib/data';
import type { AwardDataMap } from '../types';

export async function calculateMostPopularTag(
  _db: DrizzleD1Database<typeof schemaImport>,
): Promise<AwardDataMap['most-popular-tag']> {
  const tags = getAllTags();
  const winner = tags[0];
  if (!winner) {
    return { tag: '', count: 0, runnersUp: [] };
  }
  return {
    tag: winner.name,
    count: winner.count,
    runnersUp: tags.slice(1, 6).map((t) => ({ tag: t.name, count: t.count })),
  };
}
