import { name as countryName } from 'country-emoji';
import { Link } from '@tanstack/react-router';
import { iconMap } from '../lib/icons';
import type { Person } from '../lib/types';

type PersonCardProps = {
  person: Person;
  activeTagName?: string;
};

export default function PersonCard({
  person,
  activeTagName,
}: PersonCardProps) {
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
    <article className="PersonWrapper">
      <div className="PersonInner">
        <header>
          <img width="50" height="50" src={avatar} alt={person.name} loading="lazy" />
          <h3>
            <Link
              to="/people/$personSlug"
              params={{ personSlug: person.personSlug }}
            >
              {person.name}
            </Link>{' '}
            {person.emoji}
          </h3>
          <a
            target="_blank"
            rel="noopener noreferrer"
            className="displayLink"
            href={person.url}
          >
            {externalUrl.host}
            {externalUrl.pathname.replace(/\/$/, '')}
          </a>
        </header>
        <p>{person.description}</p>
        <ul className="Tags">
          {person.canonicalTags.slice(0, 10).map((tag) => (
            <li
              className={`Tag small ${activeTagName === tag ? 'currentTag' : ''}`}
              key={`${person.personSlug}-${tag}`}
            >
              <Link to="/like/$tag" params={{ tag }}>
                {tag}
              </Link>
            </li>
          ))}
        </ul>
      </div>
      <div className="PersonDeets">
        <span className="country" title={countryName(person.country)}>
          {person.country}
        </span>
        {person.computer ? (
          <span title={`Computer: ${person.computer}`}>
            <img
              height="40"
              src={iconMap[person.computer]}
              alt={person.computer}
            />
          </span>
        ) : (
          <span title="Computer: Unknown">—</span>
        )}
        {person.phone ? (
          <span title={`Uses an ${person.phone}`}>
            <img height="50" src={iconMap[person.phone]} alt={person.phone} />
          </span>
        ) : (
          <span title="Phone: Unknown">—</span>
        )}

        {person.twitter && (
          <div className="SocialHandle">
            <a
              href={`https://twitter.com/${person.twitter.replace('@', '')}`}
              target="_blank"
              rel="noopener noreferrer"
            >
              <span className="at">@</span>
              {person.twitter.replace('@', '')}
            </a>
          </div>
        )}

        {person.mastodon && !person.twitter && !person.bluesky && (
          <div className="SocialHandle">
            <a
              href={`https://${mastodonServer}/@${mastodonHandle}`}
              target="_blank"
              rel="noopener noreferrer"
            >
              <span className="at">@</span>
              {mastodonHandle}
            </a>
          </div>
        )}

        {person.bluesky && !person.mastodon && !person.twitter && (
          <div className="SocialHandle">
            <a
              href={`https://bsky.app/profile/${person.bluesky.replace('@', '')}`}
              target="_blank"
              rel="noopener noreferrer"
            >
              <span className="at">@</span>
              {person.bluesky.replace('@', '')}
            </a>
          </div>
        )}
      </div>
    </article>
  );
}
