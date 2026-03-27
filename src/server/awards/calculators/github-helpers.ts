import type { DrizzleD1Database } from 'drizzle-orm/d1';
import type * as schemaImport from '../../schema';
import * as schema from '../../schema';

const SIX_MONTHS_MS = 6 * 30 * 24 * 60 * 60 * 1000;

export type GitHubProfileRow = {
  personSlug: string;
  githubUsername: string;
  dataJson: string;
};

export type ParsedGitHubProfile = {
  personSlug: string;
  githubUsername: string;
  stats: Record<string, unknown>;
};

function hasRecentActivity(stats: Record<string, unknown>): boolean {
  const cutoff = new Date(Date.now() - SIX_MONTHS_MS);

  const contributionCount = stats.contributionCount as number | undefined;
  if (contributionCount && contributionCount > 0) return true;

  const topRepos = stats.topRepos as { pushedAt?: string }[] | undefined;
  if (topRepos?.some((r) => r.pushedAt && new Date(r.pushedAt) > cutoff)) return true;

  const repositories = stats.repositories as { nodes?: { pushedAt?: string }[] } | undefined;
  if (repositories?.nodes?.some((r) => r.pushedAt && new Date(r.pushedAt) > cutoff)) return true;

  return false;
}

export async function getActiveGitHubProfiles(
  db: DrizzleD1Database<typeof schemaImport>,
): Promise<ParsedGitHubProfile[]> {
  const rows = await db
    .select({
      personSlug: schema.githubProfiles.personSlug,
      githubUsername: schema.githubProfiles.githubUsername,
      dataJson: schema.githubProfiles.dataJson,
    })
    .from(schema.githubProfiles);

  const active: ParsedGitHubProfile[] = [];
  let skipped = 0;

  for (const row of rows) {
    try {
      const stats = JSON.parse(row.dataJson) as Record<string, unknown>;
      if (!hasRecentActivity(stats)) {
        skipped++;
        continue;
      }
      active.push({ personSlug: row.personSlug, githubUsername: row.githubUsername, stats });
    } catch {
      console.log(`[github-helpers] Failed to parse dataJson for ${row.personSlug}`);
    }
  }

  console.log(`[github-helpers] ${active.length} active profiles, ${skipped} inactive filtered out`);
  return active;
}
