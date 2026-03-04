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
      <style>{/*css*/`
        @scope (.PersonWrapper) {
          :scope {
            border-left: .5px solid var(--vape);
            border-top: .5px solid var(--vape);
            display: grid;
            grid-template-rows: 1fr auto auto;
          }
          .PersonInner {
            padding: 2rem;
            & h3 {
              margin: 0;
              & a:visited { color: var(--purple); }
            }
            & header {
              display: grid;
              grid-template-rows: auto auto;
              grid-template-columns: auto 1fr;
              grid-gap: 0 1rem;
              @media all and (max-width: 400px) {
                grid-template-columns: 1fr;
              }
              & img {
                grid-row: 1 / -1;
                font-size: 1rem;
              }
              & .displayLink {
                white-space: nowrap;
                overflow: hidden;
                text-overflow: ellipsis;
                text-decoration: none;
                color: var(--vape);
                letter-spacing: 1px;
                font-size: 1.2rem;
                max-width: 100%;
                &:hover, &:visited { color: var(--pink); }
              }
            }
          }
          .PersonDeets {
            display: flex;
            border-top: 1px solid var(--vape);
            > * {
              flex: 1;
              border-left: 1px solid var(--vape);
              text-align: center;
              padding: 1rem;
              display: grid;
              align-items: center;
              justify-content: center;
              grid-template-columns: auto auto;
              &:first-child { border-left: 0; }
            }
            & a { color: var(--vape); }
            & .country { font-size: 3rem; padding-top: 2rem; }
            & .phone { padding: 0; }
            @media all and (max-width: 400px) {
              display: grid;
              grid-template-columns: 1fr 1fr;
              > *:nth-child(1), > *:nth-child(2) {
                border-bottom: 1px solid var(--vape);
              }
            }
          }
          .SocialHandle {
            font-size: 1.24323423426928098420394802rem;
            & a span { color: var(--yellow); margin-right: 2px; }
          }
          .Tags {
            list-style-type: none;
            margin: 0;
            padding: 0;
            display: flex;
            flex-wrap: wrap;
          }
          .Tag {
            background: var(--pink);
            margin: 2px;
            border-radius: 3px;
            font-size: 1.7rem;
            text-decoration: none;
            padding: 5px;
            color: hsla(0, 100%, 100%, 0.8);
            transition: background-color 0.2s;
            display: grid;
            grid-template-columns: 1fr auto;
            align-items: center;
            &.small { font-size: 1.2rem; }
            & input { display: none; }
            &.currentTag {
              background: var(--yellow);
              color: hsla(0, 100%, 0%, 0.8);
            }
          }
        }
      `}</style>
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
              <span>@</span>
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
              <span>@</span>
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
              <span>@</span>
              {person.bluesky.replace('@', '')}
            </a>
          </div>
        )}
      </div>
    </article>
  );
}
