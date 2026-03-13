import type { DrizzleD1Database } from 'drizzle-orm/d1';
import type * as schemaImport from '../../schema';
import * as schema from '../../schema';
import type { AwardDataMap } from '../types';

export async function calculateMostPopularLanguage(
  db: DrizzleD1Database<typeof schemaImport>,
): Promise<AwardDataMap['most-popular-language']> {
  const rows = await db
    .select({ dataJson: schema.githubProfiles.dataJson })
    .from(schema.githubProfiles);

  const langMap = new Map<string, { color: string; devCount: number }>();

  for (const row of rows) {
    try {
      const stats = JSON.parse(row.dataJson) as {
        languages?: { name: string; color: string }[];
      };
      if (!stats.languages) continue;
      const seen = new Set<string>();
      for (const lang of stats.languages) {
        if (seen.has(lang.name)) continue;
        seen.add(lang.name);
        const existing = langMap.get(lang.name);
        if (existing) {
          existing.devCount++;
        } else {
          langMap.set(lang.name, { color: lang.color || '#888', devCount: 1 });
        }
      }
    } catch {
      console.log('[award:most-popular-language] Failed to parse dataJson for a profile');
    }
  }

  const sorted = Array.from(langMap.entries())
    .map(([name, data]) => ({ language: name, ...data }))
    .sort((a, b) => b.devCount - a.devCount);

  const winner = sorted[0];
  if (!winner) {
    return { language: 'Unknown', color: '#888', devCount: 0, runnersUp: [] };
  }

  return {
    language: winner.language,
    color: winner.color,
    devCount: winner.devCount,
    runnersUp: sorted.slice(1, 6),
  };
}
