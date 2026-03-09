/**
 * Fetches GitHub profile stats via the GitHub GraphQL API.
 */

export type ContributionDay = {
  date: string;
  contributionCount: number;
  color: string;
};

export type ContributionWeek = {
  contributionDays: ContributionDay[];
};

export type SocialAccount = {
  displayName: string;
  provider: string;
  url: string;
};

export type GitHubStats = {
  repoCount: number;
  followerCount: number;
  followingCount: number;
  /** Total contributions in the last year (commit-ish proxy) */
  contributionCount: number;
  /** ISO date string of when the account was created */
  createdAt: string;
  /** Top languages across recent repos, sorted by usage */
  languages: { name: string; color: string; count: number }[];
  /** Weekly contribution data for rendering a contribution graph */
  contributionWeeks: ContributionWeek[];
  bio: string | null;
  location: string | null;
  company: string | null;
  name: string | null;
  login: string;
  websiteUrl: string | null;
  socialAccounts: SocialAccount[];
};

const GITHUB_GRAPHQL = 'https://api.github.com/graphql';

const QUERY = /*graphql */ `
query UserStats($login: String!) {
  user(login: $login) {
    bio
    location
    company
    name
    id
    login
    websiteUrl
    socialAccounts(first: 10) {
      nodes {
        displayName
        provider
        url
      }
    }
    createdAt
    followers { totalCount }
    following { totalCount }
    repositories(
      first: 50
      ownerAffiliations: OWNER
      orderBy: { field: PUSHED_AT, direction: DESC }
      isFork: false
    ) {
      totalCount
      nodes {
        pushedAt
        languages(first: 5, orderBy: { field: SIZE, direction: DESC }) {
          edges {
            size
            node { name color }
          }
        }
      }
    }
    contributionsCollection {
      contributionCalendar {
        totalContributions
        # weeks {
        #   contributionDays {
        #     date
        #     contributionCount
        #     color
        #   }
        # }
      }
    }
  }
}
`;

export async function fetchGitHubStats(
  username: string,
): Promise<GitHubStats | null> {
  const token = (process.env.GITHUB_TOKEN || '').trim();
  console.log(`[github] Fetching stats for ${username}, token exists: ${!!token}, token length: ${token.length}`);
  if (!token) {
    console.warn('GITHUB_TOKEN not set — skipping GitHub stats');
    return null;
  }

  const res = await fetch(GITHUB_GRAPHQL, {
    method: 'POST',
    headers: {
      Authorization: `bearer ${token}`,
      'Content-Type': 'application/json',
      'User-Agent': 'awesome-uses',
    },
    body: JSON.stringify({ query: QUERY, variables: { login: username } }),
  });

  if (!res.ok) {
    console.error(`GitHub GraphQL error: ${res.status} ${res.statusText}`);
    return null;
  }

  // Log rate limit info from response headers
  const rateLimit = res.headers.get('x-ratelimit-remaining');
  const rateLimitTotal = res.headers.get('x-ratelimit-limit');
  const rateLimitReset = res.headers.get('x-ratelimit-reset');
  const resetDate = rateLimitReset ? new Date(Number(rateLimitReset) * 1000).toLocaleTimeString() : 'unknown';
  console.log(`[github] Rate limit: ${rateLimit}/${rateLimitTotal} remaining, resets at ${resetDate}`);

  const json = (await res.json()) as any;
  console.log(`[github] Response for ${username}:`, JSON.stringify(json).slice(0, 500));
  const user = json?.data?.user;
  if (!user) {
    console.error(`[github] No user data for ${username}`, json?.errors);
    return null;
  }

  // Aggregate languages across repos, filtering to last 4 years
  const fourYearsAgo = new Date();
  fourYearsAgo.setFullYear(fourYearsAgo.getFullYear() - 4);

  const langMap = new Map<string, { color: string; size: number }>();
  for (const repo of user.repositories.nodes ?? []) {
    if (repo.pushedAt && new Date(repo.pushedAt) < fourYearsAgo) continue;
    for (const edge of repo.languages?.edges ?? []) {
      const name = edge.node.name;
      const existing = langMap.get(name);
      if (existing) {
        existing.size += edge.size;
      } else {
        langMap.set(name, { color: edge.node.color || '#ccc', size: edge.size });
      }
    }
  }

  const languages = [...langMap.entries()]
    .sort((a, b) => b[1].size - a[1].size)
    .slice(0, 10)
    .map(([name, { color, size }]) => ({ name, color, count: size }));

  const calendar = user.contributionsCollection.contributionCalendar;

  return {
    repoCount: user.repositories.totalCount,
    followerCount: user.followers.totalCount,
    followingCount: user.following.totalCount,
    contributionCount: calendar.totalContributions,
    createdAt: user.createdAt,
    languages,
    // contributionWeeks: calendar.weeks,
    contributionWeeks: [],
    bio: user.bio ?? null,
    location: user.location ?? null,
    company: user.company ?? null,
    name: user.name ?? null,
    login: user.login,
    websiteUrl: user.websiteUrl ?? null,
    socialAccounts: (user.socialAccounts?.nodes ?? []).map((n: any) => ({
      displayName: n.displayName,
      provider: n.provider,
      url: n.url,
    })),
  };
}
