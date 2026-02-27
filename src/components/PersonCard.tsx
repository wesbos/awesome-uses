import { name as countryName } from 'country-emoji';
import { Link } from '@tanstack/react-router';
import type { Person } from '../lib/types';

type PersonCardProps = {
  person: Person;
  activeTagName?: string;
  tagSlugByName: Record<string, string>;
};

export default function PersonCard({
  person,
  activeTagName,
  tagSlugByName,
}: PersonCardProps) {
  const externalUrl = new URL(person.url);
  const twitterAvatar = person.twitter
    ? `https://unavatar.io/x/${person.twitter.replace('@', '')}`
    : null;
  const websiteAvatar = `https://unavatar.io/${externalUrl.host}`;
  const avatar = twitterAvatar
    ? `${twitterAvatar}?fallback=${websiteAvatar}`
    : websiteAvatar;

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
          {person.canonicalTags.map((tag) => (
            <li
              className={`Tag small ${activeTagName === tag ? 'currentTag' : ''}`}
              key={`${person.personSlug}-${tag}`}
            >
              <Link
                to="/tags/$tagSlug"
                params={{ tagSlug: tagSlugByName[tag] || 'unknown' }}
              >
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
        <span title={`Computer: ${person.computer || 'Unknown'}`}>
          {person.computer || '—'}
        </span>
        <span title={`Phone: ${person.phone || 'Unknown'}`}>{person.phone || '—'}</span>
      </div>
    </article>
  );
}
