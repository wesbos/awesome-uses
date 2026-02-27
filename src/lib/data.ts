import rawTagAliases from '../generated/tag-aliases.json';
import rawTagGroups from '../generated/tag-groups.json';
import rawPeople from '../generated/people.json';
import { buildUniqueSlug, slugify } from './slug';
import type {
  CountrySummary,
  DeviceSummary,
  Device,
  DirectoryData,
  DirectoryFilters,
  Person,
  PersonRecord,
  TagSummary,
} from './types';

const DEFAULT_ALIAS_MAP = rawTagAliases as Record<string, string>;
const TAG_GROUPS = rawTagGroups as Array<{
  slug: string;
  name: string;
  tags: string[];
}>;

const TAG_GROUP_BY_TAG = TAG_GROUPS.reduce<Record<string, { slug: string; name: string }>>(
  (acc, group) => {
    for (const tag of group.tags) {
      acc[tag] = { slug: group.slug, name: group.name };
    }
    return acc;
  },
  {}
);

const rawPeopleRecords = rawPeople as PersonRecord[];

function cleanToken(value: string): string {
  return value
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/[‐‑‒–—]/g, '-')
    .replace(/^\.+|\.+$/g, '');
}

function normalizeAliasKey(value: string): string {
  return cleanToken(value).toLowerCase().replace(/[^a-z0-9]+/g, '');
}

function titleCase(value: string): string {
  return value
    .split(' ')
    .filter(Boolean)
    .map((token) => token.charAt(0).toUpperCase() + token.slice(1))
    .join(' ');
}

function canonicalizeTag(tag: string): string {
  const cleaned = cleanToken(tag);
  const alias = DEFAULT_ALIAS_MAP[normalizeAliasKey(cleaned)];
  if (alias) {
    return alias;
  }

  if (/^[A-Z0-9.+/-]+$/.test(cleaned) && cleaned.length <= 5) {
    return cleaned;
  }

  const normalizedSpacing = cleaned
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/\s+/g, ' ');

  return titleCase(normalizedSpacing);
}

function unique(values: string[]): string[] {
  return Array.from(new Set(values.filter(Boolean)));
}

const personSlugRegistry = new Set<string>();

const PEOPLE: Person[] = rawPeopleRecords
  .map((person) => {
    const canonicalTags = unique((person.tags || []).map(canonicalizeTag)).sort((a, b) =>
      a.localeCompare(b)
    );

    const personSlug = buildUniqueSlug(person.name, personSlugRegistry, 'person');

    const searchableText = [
      person.name,
      person.description,
      person.country,
      person.computer,
      person.phone,
      canonicalTags.join(' '),
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();

    return {
      ...person,
      tags: unique(person.tags || []),
      canonicalTags,
      personSlug,
      searchableText,
    };
  })
  .sort((a, b) => a.name.localeCompare(b.name));

const TAG_COUNTS = new Map<string, number>();
const TAG_ALIASES = new Map<string, Set<string>>();
const TAG_SLUGS = new Map<string, string>();
const TAG_BY_SLUG = new Map<string, TagSummary>();
const usedTagSlugs = new Set<string>();

for (const person of PEOPLE) {
  for (const tag of person.canonicalTags) {
    TAG_COUNTS.set(tag, (TAG_COUNTS.get(tag) || 0) + 1);
  }

  for (const rawTag of person.tags) {
    const canonicalTag = canonicalizeTag(rawTag);
    const aliases = TAG_ALIASES.get(canonicalTag) || new Set<string>();
    aliases.add(rawTag);
    TAG_ALIASES.set(canonicalTag, aliases);
  }
}

for (const canonicalTag of TAG_COUNTS.keys()) {
  const slug = buildUniqueSlug(canonicalTag, usedTagSlugs, 'tag');
  TAG_SLUGS.set(canonicalTag, slug);
}

const TAGS: TagSummary[] = Array.from(TAG_COUNTS.entries())
  .map(([name, count]) => {
    const slug = TAG_SLUGS.get(name) || slugify(name);
    const group = TAG_GROUP_BY_TAG[name];
    return {
      name,
      slug,
      count,
      aliases: Array.from(TAG_ALIASES.get(name) || []).sort((a, b) => a.localeCompare(b)),
      groupSlug: group?.slug,
      groupName: group?.name,
    };
  })
  .sort((a, b) => {
    if (b.count !== a.count) {
      return b.count - a.count;
    }
    return a.name.localeCompare(b.name);
  });

for (const tag of TAGS) {
  TAG_BY_SLUG.set(tag.slug, tag);
}

const COUNTRIES: CountrySummary[] = Array.from(
  PEOPLE.reduce<Map<string, number>>((acc, person) => {
    acc.set(person.country, (acc.get(person.country) || 0) + 1);
    return acc;
  }, new Map<string, number>())
)
  .map(([emoji, count]) => ({ emoji, count }))
  .sort((a, b) => b.count - a.count);

const DEVICES: DeviceSummary[] = Array.from(
  PEOPLE.reduce<Map<Device, number>>((acc, person) => {
    if (person.computer) {
      acc.set(person.computer, (acc.get(person.computer) || 0) + 1);
    }
    if (person.phone) {
      acc.set(person.phone, (acc.get(person.phone) || 0) + 1);
    }
    return acc;
  }, new Map<Device, number>())
)
  .map(([name, count]) => ({ name, count }))
  .sort((a, b) => b.count - a.count);

export function getAllPeople(): Person[] {
  return PEOPLE;
}

export function getAllTags(): TagSummary[] {
  return TAGS;
}

export function getAllCountries(): CountrySummary[] {
  return COUNTRIES;
}

export function getAllDevices(): DeviceSummary[] {
  return DEVICES;
}

export function getPersonBySlug(personSlug: string): Person | undefined {
  return PEOPLE.find((person) => person.personSlug === personSlug);
}

export function getTagBySlug(tagSlug: string): TagSummary | undefined {
  return TAG_BY_SLUG.get(tagSlug);
}

export function getTagSlugByName(tagName: string): string | undefined {
  const canonical = canonicalizeTag(tagName);
  return TAG_SLUGS.get(canonical);
}

type LikeTagResolution =
  | { kind: 'tag'; raw: string; tagName: string }
  | { kind: 'country'; raw: string }
  | { kind: 'device'; raw: string; device: Device }
  | { kind: 'unknown'; raw: string };

export function resolveLikeTag(tagInput: string): LikeTagResolution {
  const raw = decodeURIComponent(tagInput || '').trim();

  const byExactName = TAGS.find((tag) => tag.name === raw);
  if (byExactName) {
    return { kind: 'tag', raw, tagName: byExactName.name };
  }

  const byCaseInsensitiveName = TAGS.find(
    (tag) => tag.name.toLowerCase() === raw.toLowerCase()
  );
  if (byCaseInsensitiveName) {
    return { kind: 'tag', raw, tagName: byCaseInsensitiveName.name };
  }

  const bySlug = TAG_BY_SLUG.get(raw.toLowerCase());
  if (bySlug) {
    return { kind: 'tag', raw, tagName: bySlug.name };
  }

  if (COUNTRIES.some((country) => country.emoji === raw)) {
    return { kind: 'country', raw };
  }

  const normalizedDevice = raw.toLowerCase() as Device;
  if (DEVICES.some((device) => device.name === normalizedDevice)) {
    return { kind: 'device', raw, device: normalizedDevice };
  }

  return { kind: 'unknown', raw };
}

export function getPeopleForLikeTag(tagInput: string): {
  people: Person[];
  rawTag: string;
  activeTagName?: string;
} {
  const resolved = resolveLikeTag(tagInput);

  if (resolved.kind === 'tag') {
    return {
      people: PEOPLE.filter((person) => person.canonicalTags.includes(resolved.tagName)),
      rawTag: resolved.raw,
      activeTagName: resolved.tagName,
    };
  }

  if (resolved.kind === 'country') {
    return {
      people: PEOPLE.filter((person) => person.country === resolved.raw),
      rawTag: resolved.raw,
    };
  }

  if (resolved.kind === 'device') {
    return {
      people: PEOPLE.filter(
        (person) =>
          person.computer === resolved.device || person.phone === resolved.device
      ),
      rawTag: resolved.raw,
    };
  }

  return {
    people: [],
    rawTag: resolved.raw,
  };
}

function matchesSearch(person: Person, q?: string): boolean {
  if (!q) return true;
  const query = q.trim().toLowerCase();
  if (!query) return true;
  return person.searchableText.includes(query);
}

export function getFilteredPeople(filters: DirectoryFilters): Person[] {
  const tagName = filters.tag ? getTagBySlug(filters.tag)?.name : undefined;

  return PEOPLE.filter((person) => {
    if (tagName && !person.canonicalTags.includes(tagName)) return false;
    if (filters.country && person.country !== filters.country) return false;
    if (
      filters.device &&
      person.computer !== filters.device &&
      person.phone !== filters.device
    ) {
      return false;
    }
    if (!matchesSearch(person, filters.q)) return false;
    return true;
  });
}

export function getDirectoryData(filters: DirectoryFilters): DirectoryData {
  return {
    people: getFilteredPeople(filters),
    totalPeople: PEOPLE.length,
    filters,
    tags: TAGS,
    countries: COUNTRIES,
    devices: DEVICES,
  };
}

export function resolveLegacyTagInput(tagInput: string): {
  redirectTo: '/like/$tag';
  params: { tag: string };
} {
  const decoded = decodeURIComponent(tagInput || '').trim();
  const tagSlug = getTagSlugByName(decoded) || getTagBySlug(decoded)?.slug;

  if (tagSlug) {
    const matchedTag = getTagBySlug(tagSlug);
    return {
      redirectTo: '/like/$tag',
      params: { tag: matchedTag?.name || decoded },
    };
  }

  if (COUNTRIES.some((country) => country.emoji === decoded)) {
    return {
      redirectTo: '/like/$tag',
      params: { tag: decoded },
    };
  }

  if (DEVICES.some((device) => device.name === decoded)) {
    return {
      redirectTo: '/like/$tag',
      params: { tag: decoded },
    };
  }

  return {
    redirectTo: '/like/$tag',
    params: { tag: decoded },
  };
}
