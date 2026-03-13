import type { DrizzleD1Database } from 'drizzle-orm/d1';
import type * as schemaImport from '../../schema';
import * as schema from '../../schema';
import { getAllPeople } from '../../../lib/data';
import type { AwardDataMap } from '../types';

type ProfileWithFollowers = {
  personSlug: string;
  name: string;
  github: string;
  followers: number;
};

export async function calculateMostGithubFollowers(
  db: DrizzleD1Database<typeof schemaImport>,
): Promise<AwardDataMap['most-github-followers']> {
  const rows = await db
    .select({
      personSlug: schema.githubProfiles.personSlug,
      githubUsername: schema.githubProfiles.githubUsername,
      dataJson: schema.githubProfiles.dataJson,
    })
    .from(schema.githubProfiles);

  const allPeople = getAllPeople();
  const peopleMap = new Map(allPeople.map((p) => [p.personSlug, p]));

  const profiles: ProfileWithFollowers[] = [];

  for (const row of rows) {
    try {
      const stats = JSON.parse(row.dataJson) as { followerCount?: number };
      const person = peopleMap.get(row.personSlug);
      profiles.push({
        personSlug: row.personSlug,
        name: person?.name ?? row.githubUsername,
        github: row.githubUsername,
        followers: stats.followerCount ?? 0,
      });
    } catch {
      console.log(`[award:most-github-followers] Failed to parse dataJson for ${row.personSlug}`);
    }
  }

  profiles.sort((a, b) => b.followers - a.followers);

  const winner = profiles[0];
  if (!winner) {
    return {
      person: { personSlug: '', name: '', github: '' },
      followers: 0,
      runnersUp: [],
    };
  }

  return {
    person: { personSlug: winner.personSlug, name: winner.name, github: winner.github },
    followers: winner.followers,
    runnersUp: profiles.slice(1, 6).map((p) => ({
      personSlug: p.personSlug,
      name: p.name,
      github: p.github,
      followers: p.followers,
    })),
  };
}
