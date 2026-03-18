import type { Person } from './types';

/**
 * Build an unavatar URL with a chained fallback order:
 * X/Twitter -> GitHub -> Bluesky -> Mastodon instance -> website domain
 *
 * Each source uses unavatar's `?fallback=` param so the browser gets the
 * first avatar that resolves successfully.
 */
export function getAvatarUrl(
  person: Pick<Person, 'url' | 'twitter' | 'github' | 'bluesky' | 'mastodon'>,
): string {
  const sources: string[] = [];

  if (person.twitter) {
    sources.push(
      `https://unavatar.io/x/${person.twitter.replace('@', '')}`,
    );
  }

  if (person.github) {
    sources.push(`https://unavatar.io/github/${person.github}`);
  }

  if (person.bluesky) {
    sources.push(`https://unavatar.io/bluesky/${person.bluesky}`);
  }

  if (person.mastodon) {
    const handle = person.mastodon.replace(/^@/, '');
    const atIdx = handle.indexOf('@');
    if (atIdx !== -1) {
      const instance = handle.slice(atIdx + 1);
      const user = handle.slice(0, atIdx);
      sources.push(`https://unavatar.io/${instance}/${user}`);
    }
  }

  const host = new URL(person.url).host;
  sources.push(`https://unavatar.io/${host}`);

  return sources.reduceRight((fallback, source) =>
    fallback ? `${source}?fallback=${encodeURIComponent(fallback)}` : source,
  );
}

/**
 * Returns the URL for a person's stippled avatar (served via the API route).
 * Falls back to unavatar.io if no generated avatar exists.
 */
export function getStippledAvatarUrl(personSlug: string): string {
  return `/api/avatar/${personSlug}`;
}
