import type { DrizzleD1Database } from 'drizzle-orm/d1';
import type * as schemaImport from '../../schema';
import { getAllPeople } from '../../../lib/data';
import type { AwardDataMap } from '../types';
import { getActiveGitHubProfiles } from './github-helpers';
import { toPersonRefWithGithub } from './person-ref';

export async function calculateMostGithubFollowers(
  db: DrizzleD1Database<typeof schemaImport>,
): Promise<AwardDataMap['most-github-followers']> {
  const profiles = await getActiveGitHubProfiles(db);

  const allPeople = getAllPeople();
  const peopleMap = new Map(allPeople.map((p) => [p.personSlug, p]));

  const entries = profiles
    .map(({ personSlug, githubUsername, stats }) => {
      const person = peopleMap.get(personSlug);
      return {
        personSlug,
        person,
        github: githubUsername,
        followers: (stats.followerCount as number) ?? 0,
      };
    })
    .filter((e) => e.person);

  entries.sort((a, b) => b.followers - a.followers);

  const winner = entries[0];
  if (!winner?.person) {
    return {
      person: { personSlug: '', name: '', avatarUrl: '', github: '' },
      followers: 0,
      runnersUp: [],
    };
  }

  return {
    person: toPersonRefWithGithub(winner.person),
    followers: winner.followers,
    runnersUp: entries.slice(1, 6).map((p) => ({
      ...toPersonRefWithGithub(p.person!),
      followers: p.followers,
    })),
  };
}
