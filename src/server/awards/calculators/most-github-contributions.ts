import type { DrizzleD1Database } from 'drizzle-orm/d1';
import type * as schemaImport from '../../schema';
import { getAllPeople } from '../../../lib/data';
import type { AwardDataMap } from '../types';
import { getActiveGitHubProfiles } from './github-helpers';
import { toPersonRefWithGithub } from './person-ref';

export async function calculateMostGithubContributions(
  db: DrizzleD1Database<typeof schemaImport>,
): Promise<AwardDataMap['most-github-contributions']> {
  const profiles = await getActiveGitHubProfiles(db);

  const allPeople = getAllPeople();
  const peopleMap = new Map(allPeople.map((p) => [p.personSlug, p]));

  const entries = profiles
    .map(({ personSlug, stats }) => {
      const person = peopleMap.get(personSlug);
      return {
        person,
        contributions: (stats.contributionCount as number) ?? 0,
      };
    })
    .filter((e) => e.person);

  entries.sort((a, b) => b.contributions - a.contributions);

  return {
    contributors: entries.slice(0, 5).map((e) => ({
      person: toPersonRefWithGithub(e.person!),
      contributions: e.contributions,
    })),
  };
}
