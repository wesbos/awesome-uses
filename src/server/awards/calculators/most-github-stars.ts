import type { DrizzleD1Database } from 'drizzle-orm/d1';
import type * as schemaImport from '../../schema';
import { getAllPeople } from '../../../lib/data';
import type { AwardDataMap } from '../types';
import { getActiveGitHubProfiles } from './github-helpers';
import { toPersonRefWithGithub } from './person-ref';

export async function calculateMostGithubStars(
  db: DrizzleD1Database<typeof schemaImport>,
): Promise<AwardDataMap['most-github-stars']> {
  const profiles = await getActiveGitHubProfiles(db);

  const allPeople = getAllPeople();
  const peopleMap = new Map(allPeople.map((p) => [p.personSlug, p]));

  const allRepos: {
    repoName: string;
    repoUrl: string;
    stars: number;
    person: ReturnType<typeof toPersonRefWithGithub>;
  }[] = [];

  for (const { personSlug, githubUsername, stats } of profiles) {
    const topRepos = stats.topRepos as { name: string; stars: number; url: string }[] | undefined;
    if (!topRepos) continue;
    const person = peopleMap.get(personSlug);
    if (!person) continue;

    const ref = toPersonRefWithGithub(person);
    for (const repo of topRepos) {
      if (repo.stars > 0) {
        allRepos.push({
          repoName: repo.name,
          repoUrl: repo.url,
          stars: repo.stars,
          person: ref,
        });
      }
    }
  }

  allRepos.sort((a, b) => b.stars - a.stars);

  return {
    repos: allRepos.slice(0, 5).map((r) => ({
      repoName: r.repoName,
      repoUrl: r.repoUrl,
      stars: r.stars,
      person: r.person,
    })),
  };
}
