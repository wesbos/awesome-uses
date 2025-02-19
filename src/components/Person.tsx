import React, { useState, useEffect, useRef } from 'react';
import PropTypes from 'prop-types';
import { name } from 'country-emoji';
import { useParams } from '@remix-run/react';
import * as icons from '../util/icons';
import { Person } from '../../scripts/utils';

export default function PersonComponent({ person }: { person: Person }) {
  const url = new URL(person.url);
  const twitter = person.twitter
    ? `https://unavatar.io/x/${person.twitter.replace('@', '')}`
    : '';
  const website = `https://unavatar.io/${url.host}`;
  const unavatar = person.twitter
    ? `${twitter}?fallback=${website}&ttl=28d`
    : website;
  const [_, mastodonHandle, mastodonServer] = person.mastodon?.split('@') || [];
  const { tag: currentTag } = useParams();
  return (
    <div
      className="PersonWrapper"
      style={{ contentVisibility: 'auto', containIntrinsicHeight: '560px' }}
    >
      <div className="PersonInner">
        <header>
          <img
            width="50"
            height="50"
            src={unavatar}
            alt={person.name}
            onError={({ currentTarget }) => {
              currentTarget.onerror = null; // prevents looping
              currentTarget.src = '/default.png';
            }}
            loading="lazy"
          />
          <h3>
            <a href={person.url} target="_blank" rel="noopener noreferrer">
              {person.name}
            </a>{' '}
            {person.emoji}
          </h3>
          <a
            target="_blank"
            rel="noopener noreferrer"
            className="displayLink"
            href={person.url}
          >
            {url.host}
            {url.pathname.replace(/\/$/, '')}
          </a>
        </header>
        <p>{person.description}</p>
        <ul className="Tags">
          {person.tags?.map((tag) => (
            <li
              className={`Tag small ${tag === currentTag ? 'currentTag' : ''}`}
              key={tag}
            >
              {tag}
            </li>
          ))}
        </ul>
      </div>
      <div className="PersonDeets">
        <span className="country" title={name(person.country)}>
          {person.country}
        </span>
        {person.computer && (
          <span title={`Computer: ${person.computer}`}>
            <img
              height="40"
              src={icons[person.computer]}
              alt={person.computer}
            />
          </span>
        )}
        {person.phone && (
          <span title={`Uses an ${person.phone}`}>
            <img height="50" src={icons[person.phone]} alt={person.phone} />
          </span>
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

        {/* If they have a bluesky, and no twitter/mastodon, show that */}
        {person.bluesky && !person.twitter && (
          <div className="SocialHandle">
            <a
              href={`https://bsky.app/profile/${person.bluesky.replace(
                '@',
                ''
              )}`}
              target="_blank"
              rel="noopener noreferrer"
            >
              <span className="at">@</span>
              {person.bluesky.substring(1)}
            </a>
          </div>
        )}

        {/* If they have a mastodon, and no twitter, show that */}
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

        {/* If they have a bluesky, and no mastodon and no twitter, show that */}
        {person.bluesky && !person.mastodon && !person.twitter && (
          <div className="SocialHandle">
            <a
              href={`https://bsky.app/profile/${person.bluesky}`}
              target="_blank"
              rel="noopener noreferrer"
            >
              <span className="at">@</span>
              {person.bluesky}
            </a>
          </div>
        )}
      </div>
    </div>
  );
}
