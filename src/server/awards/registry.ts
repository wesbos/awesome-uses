import type { DrizzleD1Database } from 'drizzle-orm/d1';
import type * as schemaImport from '../schema';
import type { AwardKey, AwardDataMap } from './types';

export type AwardCalculator<K extends AwardKey> = (
  db: DrizzleD1Database<typeof schemaImport>,
) => Promise<AwardDataMap[K]>;

export type AwardRegistryEntry<K extends AwardKey = AwardKey> = {
  key: K;
  title: string;
  description: string;
  calculate: AwardCalculator<K>;
};

type AwardRegistryMap = {
  [K in AwardKey]: AwardRegistryEntry<K>;
};

import { calculateMostPopularLanguage } from './calculators/most-popular-language';
import { calculateLongestDomain, calculateShortestDomain } from './calculators/domain-length';
import { calculateMostGithubFollowers } from './calculators/most-github-followers';
import { calculateMostCommonTld, calculateRarestTld } from './calculators/tld';
import { calculateMostPopularTag } from './calculators/most-popular-tag';
import { calculateLongestName, calculateShortestName } from './calculators/name-length';
import { calculateMostPopularProduct } from './calculators/most-popular-product';
import { calculateMostSimilarPeople, calculateMostOppositePeople } from './calculators/people-similarity';
import { calculateMostGithubContributions } from './calculators/most-github-contributions';
import { calculateMostGithubStars } from './calculators/most-github-stars';

export const AWARD_REGISTRY: AwardRegistryMap = {
  'most-popular-language': {
    key: 'most-popular-language',
    title: 'Most Popular Language',
    description: 'The programming language used by the most developers',
    calculate: calculateMostPopularLanguage,
  },
  'longest-domain': {
    key: 'longest-domain',
    title: 'Longest Domain',
    description: 'The developer with the longest domain name',
    calculate: calculateLongestDomain,
  },
  'shortest-domain': {
    key: 'shortest-domain',
    title: 'Shortest Domain',
    description: 'The developer with the shortest domain name',
    calculate: calculateShortestDomain,
  },
  'most-github-followers': {
    key: 'most-github-followers',
    title: 'Most GitHub Followers',
    description: 'The developer with the most GitHub followers',
    calculate: calculateMostGithubFollowers,
  },
  'most-common-tld': {
    key: 'most-common-tld',
    title: 'Most Common TLD',
    description: 'The most popular top-level domain among developers',
    calculate: calculateMostCommonTld,
  },
  'rarest-tld': {
    key: 'rarest-tld',
    title: 'Rarest TLD',
    description: 'The rarest top-level domain among developers',
    calculate: calculateRarestTld,
  },
  'most-popular-tag': {
    key: 'most-popular-tag',
    title: 'Most Popular Tag',
    description: 'The tag that appears on the most developer profiles',
    calculate: calculateMostPopularTag,
  },
  'longest-name': {
    key: 'longest-name',
    title: 'Longest Name',
    description: 'The developer with the longest name',
    calculate: calculateLongestName,
  },
  'shortest-name': {
    key: 'shortest-name',
    title: 'Shortest Name',
    description: 'The developer with the shortest name',
    calculate: calculateShortestName,
  },
  'most-popular-product': {
    key: 'most-popular-product',
    title: 'Most Popular Product',
    description: 'The product used by the most developers',
    calculate: calculateMostPopularProduct,
  },
  'most-similar-people': {
    key: 'most-similar-people',
    title: 'Most Similar People',
    description: 'The two developers with the most similar setups based on vector similarity',
    calculate: calculateMostSimilarPeople,
  },
  'most-opposite-people': {
    key: 'most-opposite-people',
    title: 'Most Opposite People',
    description: 'The two developers with the most different setups based on vector similarity',
    calculate: calculateMostOppositePeople,
  },
  'most-github-contributions': {
    key: 'most-github-contributions',
    title: 'Most GitHub Contributions',
    description: 'The developers with the most GitHub contributions in the last year',
    calculate: calculateMostGithubContributions,
  },
  'most-github-stars': {
    key: 'most-github-stars',
    title: 'Most GitHub Stars',
    description: 'The developer with the most total stars across their repos',
    calculate: calculateMostGithubStars,
  },
};

export const ALL_AWARD_KEYS = Object.keys(AWARD_REGISTRY) as AwardKey[];
