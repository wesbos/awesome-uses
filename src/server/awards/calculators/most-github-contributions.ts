import type { DrizzleD1Database } from 'drizzle-orm/d1';
import type * as schemaImport from '../../schema';
import * as schema from '../../schema';
import { getAllPeople } from '../../../lib/data';
import type { AwardDataMap } from '../types';

export async function calculateMostGithubContributions(
  db: DrizzleD1Database<typeof schemaImport>,
): Promise<AwardDataMap['most-github-contributions']> {
  const rows = await db
    .select({
      personSlug: schema.githubProfiles.personSlug,
      githubUsername: schema.githubProfiles.githubUsername,
      dataJson: schema.githubProfiles.dataJson,
    })
    .from(schema.githubProfiles);

  const allPeople = getAllPeople();
  const peopleMap = new Map(allPeople.map((p) => [p.personSlug, p]));

  const entries: { personSlug: string; name: string; github: string; contributions: number }[] = [];

  for (const row of rows) {
    try {
      const stats = JSON.parse(row.dataJson) as { contributionCount?: number };
      const person = peopleMap.get(row.personSlug);
      entries.push({
        personSlug: row.personSlug,
        name: person?.name ?? row.githubUsername,
        github: row.githubUsername,
        contributions: stats.contributionCount ?? 0,
      });
    } catch {
      console.log(`[award:most-github-contributions] Failed to parse dataJson for ${row.personSlug}`);
    }
  }

  entries.sort((a, b) => b.contributions - a.contributions);

  return {
    contributors: entries.slice(0, 5).map((e) => ({
      person: { personSlug: e.personSlug, name: e.name, github: e.github },
      contributions: e.contributions,
    })),
  };
}
