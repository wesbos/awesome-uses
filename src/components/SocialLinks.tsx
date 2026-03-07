import type { Person } from '../lib/types';

type SocialLinksProps = {
  person: Pick<Person, 'twitter' | 'mastodon' | 'bluesky'>;
  className?: string;
};

const linkClass = 'hover:text-foreground transition-colors';

export function SocialLinks({ person, className }: SocialLinksProps) {
  const [, mastodonHandle, mastodonServer] = person.mastodon?.split('@') || [];
  const links: { href: string; label: string }[] = [];

  if (person.twitter) {
    const handle = person.twitter.replace('@', '');
    links.push({ href: `https://twitter.com/${handle}`, label: `@${handle}` });
  }
  if (person.bluesky) {
    const handle = person.bluesky.replace('@', '');
    links.push({ href: `https://bsky.app/profile/${handle}`, label: `@${handle}` });
  }
  if (person.mastodon && mastodonHandle && mastodonServer) {
    links.push({
      href: `https://${mastodonServer}/@${mastodonHandle}`,
      label: `@${mastodonHandle}`,
    });
  }

  if (links.length === 0) return null;

  return (
    <div className={className}>
      {links.map((link, i) => (
        <span key={link.href}>
          <a
            href={link.href}
            target="_blank"
            rel="noopener noreferrer"
            className={linkClass}
          >
            {link.label}
          </a>
          {i < links.length - 1 && <span className="mx-1.5 text-border">·</span>}
        </span>
      ))}
    </div>
  );
}
