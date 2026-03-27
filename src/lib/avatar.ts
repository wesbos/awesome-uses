import type { Person } from "./types";

/**
 * Build an unavatar URL with a chained fallback order:
 * X/Twitter -> GitHub -> Bluesky -> Mastodon instance -> website domain
 *
 * Each source uses unavatar's `?fallback=` param so the browser gets the
 * first avatar that resolves successfully.
 */
export type AvatarSource = { service: string; identifier: string };

export type GitHubSocialAccount = {
  provider: string;
  displayName: string;
  url: string;
};

export function getAvatarSources(
  person: Pick<Person, "url" | "twitter" | "github" | "bluesky" | "mastodon">,
  githubSocials?: GitHubSocialAccount[],
): AvatarSource[] {
  const sources: AvatarSource[] = [];
  const seen = new Set<string>();
  const add = (source: AvatarSource) => {
    const key = `${source.service}:${source.identifier}`;
    if (seen.has(key)) return;
    seen.add(key);
    sources.push(source);
  };

  if (person.twitter) {
    add({ service: "x", identifier: person.twitter.replace("@", "") });
  }
  if (person.bluesky) {
    add({ service: "bluesky", identifier: person.bluesky });
  }
  if (person.mastodon) {
    const handle = person.mastodon.replace(/^@/, "");
    if (handle.includes("@")) {
      add({ service: "mastodon", identifier: handle });
    }
  }

  // Enrich from GitHub social accounts (may add twitter, bluesky, mastodon, linkedin not in the person record)
  if (githubSocials) {
    for (const social of githubSocials) {
      const provider = social.provider.toUpperCase();
      const name = social.displayName || social.url;
      if (provider === "TWITTER") {
        add({ service: "x", identifier: name.replace("@", "").replace("https://twitter.com/", "").replace("https://x.com/", "") });
      } else if (provider === "BLUESKY") {
        add({ service: "bluesky", identifier: name.replace("@", "") });
      } else if (provider === "MASTODON") {
        const handle = name.replace(/^@/, "");
        if (handle.includes("@")) {
          add({ service: "mastodon", identifier: handle });
        }
      } else if (provider === "LINKEDIN") {
        const slug = name.replace(/^(https?:\/\/)?(www\.)?linkedin\.com\//, "").replace(/^in\//, "").replace(/\/$/, "");
        if (slug) add({ service: "linkedin", identifier: slug });
      } else if (provider === "YOUTUBE") {
        const channel = name.replace(/^(https?:\/\/)?(www\.)?youtube\.com\//, "").replace(/^@/, "").replace(/\/$/, "");
        if (channel) add({ service: "youtube", identifier: channel });
      } else if (provider === "INSTAGRAM") {
        const handle = name.replace(/^(https?:\/\/)?(www\.)?instagram\.com\//, "").replace("@", "").replace(/\/$/, "");
        if (handle) add({ service: "instagram", identifier: handle });
      }
    }
  }

  if (person.github) {
    add({ service: "github", identifier: person.github });
  }

  const host = new URL(person.url).host;
  add({ service: "domain", identifier: host });

  return sources;
}

export function avatarSourceToProxyUrl(source: AvatarSource): string {
  return `/api/unavatar/${source.service}/${source.identifier}`;
}

export function getAvatarUrl(
  person: Pick<Person, "url" | "twitter" | "github" | "bluesky" | "mastodon">,
  githubSocials?: GitHubSocialAccount[],
): string {
  const sources = getAvatarSources(person, githubSocials);
  const [primary, ...rest] = sources;
  const base = avatarSourceToProxyUrl(primary);
  if (rest.length === 0) return base;
  const fallbacks = rest.map((s) => `${s.service}:${s.identifier}`).join(",");
  return `${base}?fallback=${encodeURIComponent(fallbacks)}`;
}

const UNAVATAR_BASE = process.env.UNAVATAR_BASE_URL || "https://unavatar.io";

/** Direct unavatar URL (for server-side fetches where we can set headers ourselves). */
export function getDirectAvatarUrl(
  person: Pick<Person, "url" | "twitter" | "github" | "bluesky" | "mastodon">,
): string {
  if (person.github) return `${UNAVATAR_BASE}/github/${person.github}`;
  if (person.twitter) return `${UNAVATAR_BASE}/x/${person.twitter.replace("@", "")}`;
  if (person.bluesky) return `${UNAVATAR_BASE}/bluesky/${person.bluesky}`;
  if (person.mastodon) {
    const handle = person.mastodon.replace(/^@/, "");
    if (handle.includes("@")) {
      return `${UNAVATAR_BASE}/mastodon/${handle}`;
    }
  }
  const host = new URL(person.url).host;
  return `${UNAVATAR_BASE}/${host}`;
}

/**
 * Returns the URL for a person's stippled avatar (served via the API route).
 * Falls back to unavatar.io if no generated avatar exists.
 */
export function getStippledAvatarUrl(personSlug: string): string {
  return `/api/avatar/${personSlug}`;
}
