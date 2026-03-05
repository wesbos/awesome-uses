import { name as countryName } from 'country-emoji';
import { Link } from '@tanstack/react-router';
import { iconMap } from '../lib/icons';
import type { Person } from '../lib/types';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardFooter } from '@/components/ui/card';

type PersonCardProps = {
  person: Person;
  activeTagName?: string;
};

export default function PersonCard({ person, activeTagName }: PersonCardProps) {
  const externalUrl = new URL(person.url);
  const twitterAvatar = person.twitter
    ? `https://unavatar.io/x/${person.twitter.replace('@', '')}`
    : null;
  const websiteAvatar = `https://unavatar.io/${externalUrl.host}`;
  const avatar = twitterAvatar
    ? `${twitterAvatar}?fallback=${websiteAvatar}`
    : websiteAvatar;
  const [, mastodonHandle, mastodonServer] = person.mastodon?.split('@') || [];

  return (
    <Card
      className="rounded-[4px] [corner-shape:bevel] border-[0.5px]"
    >
      <CardContent className="p-4 space-y-3">
        <header className="flex items-start gap-3">
          <img
            width="40"
            height="40"
            src={avatar}
            alt={person.name}
            loading="lazy"
            className="rounded-full"
          />
          <div className="min-w-0 flex-1">
            <h3 className="text-sm font-semibold leading-tight">
              <Link
                to="/people/$personSlug"
                params={{ personSlug: person.personSlug }}
                className="hover:underline"
              >
                {person.name}
              </Link>{" "}
              {person.emoji}
            </h3>
            <a
              target="_blank"
              rel="noopener noreferrer"
              className="block truncate text-xs text-muted-foreground hover:text-foreground transition-colors"
              href={person.url}
            >
              {externalUrl.host}
              {externalUrl.pathname.replace(/\/$/, "")}
            </a>
          </div>
        </header>

        {person.description && (
          <p className="text-xs text-muted-foreground line-clamp-2">
            {person.description}
          </p>
        )}

        <div className="flex flex-wrap gap-1">
          {person.canonicalTags.slice(0, 10).map((tag) => (
            <Badge
              key={`${person.personSlug}-${tag}`}
              variant={activeTagName === tag ? "default" : "secondary"}
              className="text-[10px] px-1.5 py-0"
            >
              <Link to="/like/$tag" params={{ tag }}>
                {tag}
              </Link>
            </Badge>
          ))}
        </div>
      </CardContent>

      <CardFooter className="px-4 py-2 text-xs text-muted-foreground">
        <div className="flex items-center gap-3 w-full content-center justify-center">
          <span className="text-lg" title={countryName(person.country)}>
            {person.country}
          </span>

          {person.computer && (
            <img
              src={iconMap[person.computer]}
              alt={person.computer}
              title={person.computer}
              className="h-5 w-auto shrink-0"
            />
          )}

          {person.phone && (
            <img
              src={iconMap[person.phone]}
              alt={person.phone}
              title={person.phone}
              className="h-6 w-auto shrink-0"
            />
          )}

          <div>
            {person.twitter && (
              <a
                href={`https://twitter.com/${person.twitter.replace("@", "")}`}
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-foreground transition-colors"
              >
                @{person.twitter.replace("@", "")}
              </a>
            )}

            {person.mastodon && !person.twitter && !person.bluesky && (
              <a
                href={`https://${mastodonServer}/@${mastodonHandle}`}
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-foreground transition-colors"
              >
                @{mastodonHandle}
              </a>
            )}

            {person.bluesky && !person.mastodon && !person.twitter && (
              <a
                href={`https://bsky.app/profile/${person.bluesky.replace(
                  "@",
                  "",
                )}`}
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-foreground transition-colors"
              >
                @{person.bluesky.replace("@", "")}
              </a>
            )}
          </div>
        </div>
      </CardFooter>
    </Card>
  );
}
