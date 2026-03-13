import type { DrizzleD1Database } from 'drizzle-orm/d1';
import type * as schemaImport from '../../schema';
import * as schema from '../../schema';
import { getAllPeople } from '../../../lib/data';
import type { AwardDataMap } from '../types';

type RepoEntry = {
  repoName: string;
  repoUrl: string;
  stars: number;
  personSlug: string;
  name: string;
  github: string;
};

export async function calculateMostGithubStars(
  db: DrizzleD1Database<typeof schemaImport>,
): Promise<AwardDataMap['most-github-stars']> {
  const rows = await db
    .select({
      personSlug: schema.githubProfiles.personSlug,
      githubUsername: schema.githubProfiles.githubUsername,
      dataJson: schema.githubProfiles.dataJson,
    })
    .from(schema.githubProfiles);

  const allPeople = getAllPeople();
  const peopleMap = new Map(allPeople.map((p) => [p.personSlug, p]));

  const allRepos: RepoEntry[] = [];

  for (const row of rows) {
    try {
      const stats = JSON.parse(row.dataJson) as {
        topRepos?: { name: string; stars: number; url: string }[];
      };
      if (!stats.topRepos) continue;
      const person = peopleMap.get(row.personSlug);
      const personName = person?.name ?? row.githubUsername;

      for (const repo of stats.topRepos) {
        if (repo.stars > 0) {
          allRepos.push({
            repoName: repo.name,
            repoUrl: repo.url,
            stars: repo.stars,
            personSlug: row.personSlug,
            name: personName,
            github: row.githubUsername,
          });
        }
      }
    } catch {
      console.log(`[award:most-github-stars] Failed to parse dataJson for ${row.personSlug}`);
    }
  }

  allRepos.sort((a, b) => b.stars - a.stars);

  return {
    repos: allRepos.slice(0, 5).map((r) => ({
      repoName: r.repoName,
      repoUrl: r.repoUrl,
      stars: r.stars,
      person: { personSlug: r.personSlug, name: r.name, github: r.github },
    })),
  };
}
