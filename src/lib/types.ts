export type Computer = 'apple' | 'windows' | 'linux' | 'bsd';
export type Phone = 'iphone' | 'android' | 'windowsphone' | 'flipphone';
export type Device = Computer | Phone;

export type PersonRecord = {
  name: string;
  github?: string;
  description: string;
  url: string;
  country: string;
  twitter?: string;
  mastodon?: string;
  bluesky?: string;
  emoji?: string;
  computer?: Computer;
  phone?: Phone;
  tags: string[];
};

export type Person = PersonRecord & {
  personSlug: string;
  canonicalTags: string[];
  searchableText: string;
};

export type TagSummary = {
  name: string;
  slug: string;
  count: number;
  aliases: string[];
  groupSlug?: string;
  groupName?: string;
};

export type CountrySummary = {
  emoji: string;
  count: number;
};

export type DeviceSummary = {
  name: Device;
  count: number;
};

export type DirectoryFilters = {
  tag?: string;
  country?: string;
  device?: Device;
  q?: string;
};

export type DirectoryData = {
  people: Person[];
  totalPeople: number;
  filters: DirectoryFilters;
  tags: TagSummary[];
  countries: CountrySummary[];
  devices: DeviceSummary[];
};

export type ScrapeStatusRow = {
  personSlug: string;
  url: string;
  statusCode: number | null;
  fetchedAt: string;
  title: string | null;
  vectorizedAt: string | null;
};

export type PersonItem = {
  item: string;
  itemSlug: string;
  tags: string[];
  detail: string | null;
};

export type ScrapedProfileData = {
  personSlug: string;
  url: string;
  statusCode: number | null;
  fetchedAt: string;
  title: string | null;
  contentMarkdown: string | null;
};

export type NameFact = { name: string; personSlug: string };
export type DomainFact = { domain: string; personSlug: string; name: string };
export type TldFact = { tld: string; count: number };
export type TagFact = { name: string; count: number };

export type DirectoryFacts = {
  shortestName: NameFact;
  longestName: NameFact;
  shortestDomain: DomainFact;
  longestDomain: DomainFact;
  topTlds: TldFact[];
  bottomTlds: TldFact[];
  topTags: TagFact[];
};
