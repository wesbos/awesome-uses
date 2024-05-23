import React, { useState, useEffect, useRef } from 'react';
import PropTypes from 'prop-types';
import { name } from 'country-emoji';
import { useParams } from '@remix-run/react';
import * as icons from '../util/icons';

export default function Person({ person }) {
  const url = new URL(person.url);
  const twitter = person.twitter
    ? `https://unavatar.io/${person.twitter.replace('@', '')}`
    : null;
  const mastodonArr = person.mastodon
    ? person.mastodon.replace('@', '').split('@')
    : null;
  const website = `https://unavatar.io/${url.host}`;
  const unavatar = person.twitter
    ? `${twitter}?fallback=${website}&ttl=28d`
    : website;
  // const img = `https://images.weserv.nl/?url=${unavatar}&w=100&l=9&af&il&n=-1`;
  const img = unavatar;
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
            src={img}
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
          {person.tags.map((tag) => (
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

        {person.twitter || person.mastodon && (
          <div className="SocialHandle">
            <a
              href={
                person.twitter
                ? `https://twitter.com/${person.twitter.replace('@', '')}`
                : `https://${mastodonArr[1]}/@${mastodonArr[0]}`
              }
              target="_blank"
              rel="noopener noreferrer"
            >
              <span className="at">@</span>
              {
                person.twitter
                ? person.twitter.replace('@', '')
                : `${mastodonArr[1]}/@${mastodonArr[0]}`
              }
            </a>
          </div>
        )}
      </div>
    </div>
  );
}

Person.propTypes = {
  person: PropTypes.shape({
    github: PropTypes.string,
    name: PropTypes.string,
    url: PropTypes.string,
    emoji: PropTypes.string,
    description: PropTypes.string,
    tags: PropTypes.arrayOf(PropTypes.string),
    country: PropTypes.string,
    computer: PropTypes.oneOf(['apple', 'windows', 'linux']),
    phone: PropTypes.oneOf(['iphone', 'android', 'windowsphone', 'flipphone']),
    twitter(props, propName, componentName) {
      if (!/^@?(\w){1,15}$/.test(props[propName])) {
        return new Error(
          `Invalid prop \`${propName}\` supplied to` +
            ` \`${componentName}\`. This isn't a legit Twitter handle.`
        );
      }
    },
    mastodon(props, propName, componentName) {
      if (!/^@(\w){1,30}@(\w)+\.(\w)+$/.test(props[propName])) {
        return new Error(
          `Invalid prop \`${propName}\` supplied to` +
            ` \`${componentName}\`. This isn't a legit Mastodon handle.`
        );
      }
    },
  }),
};
