import type { DrizzleD1Database } from 'drizzle-orm/d1';
import type * as schemaImport from '../../schema';
import { getAllPeople } from '../../../lib/data';
import type { AwardDataMap } from '../types';

function getTldCounts() {
  const tldCounts = new Map<string, number>();
  for (const p of getAllPeople()) {
    const host = new URL(p.url).hostname;
    const tld = '.' + host.split('.').pop();
    tldCounts.set(tld, (tldCounts.get(tld) || 0) + 1);
  }
  return Array.from(tldCounts.entries())
    .map(([tld, count]) => ({ tld, count }))
    .sort((a, b) => b.count - a.count);
}

export async function calculateMostCommonTld(
  _db: DrizzleD1Database<typeof schemaImport>,
): Promise<AwardDataMap['most-common-tld']> {
  const sorted = getTldCounts();
  const winner = sorted[0];
  if (!winner) {
    return { tld: '', count: 0, runnersUp: [] };
  }
  return {
    tld: winner.tld,
    count: winner.count,
    runnersUp: sorted.slice(1, 6),
  };
}

export async function calculateRarestTld(
  _db: DrizzleD1Database<typeof schemaImport>,
): Promise<AwardDataMap['rarest-tld']> {
  const sorted = getTldCounts().reverse();
  const winner = sorted[0];
  if (!winner) {
    return { tld: '', count: 0, runnersUp: [] };
  }
  return {
    tld: winner.tld,
    count: winner.count,
    runnersUp: sorted.slice(1, 6),
  };
}
