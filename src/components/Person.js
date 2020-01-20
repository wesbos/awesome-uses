import React from 'react';
import PropTypes from 'prop-types';
import { name } from 'country-emoji';
import styled from 'styled-components';

import { Tag, Tags } from './Topics';
import * as icons from '../util/icons';

export default function Person({ hit, currentTag }) {
  const url = new URL(hit.url);
  const img = `https://images.weserv.nl/?url=https://unavatar.now.sh/${url.host}&w=100&l=9&af&il&n=-1`;
  return (
    <PersonWrapper>
      <PersonInner>
        <header>
          <img width={50} height={50} src={img} alt={hit.name} />
          <h3>
            <a href={hit.url} target="_blank" rel="noopener noreferrer">
              {hit.name}
            </a>{' '}
            {hit.emoji}
          </h3>
          <a
            target="_blank"
            rel="noopener noreferrer"
            className="displayLink"
            href={hit.url}
          >
            {url.host}
            {url.pathname.replace(/\/$/, '')}
          </a>
        </header>
        <p>{hit.description}</p>
        <Tags>
          {hit.tags.map(tag => (
            <Tag
              key={`${hit.name}-${tag}`}
              as="li"
              currentTag={tag === currentTag}
              small
            >
              {tag}
            </Tag>
          ))}
        </Tags>
      </PersonInner>
      <PersonDeets>
        <span className="country" title={name(hit.country)}>
          {hit.country}
        </span>
        {hit.computer && (
          <span title={`Computer: ${hit.computer}`}>
            <img height={40} src={icons[hit.computer]} alt={hit.computer} />
          </span>
        )}
        {hit.phone && (
          <span title={`Uses an ${hit.phone}`}>
            <img height={50} src={icons[hit.phone]} alt={hit.phone} />
          </span>
        )}

        {hit.twitter && (
          <TwitterHandle>
            <a
              href={`https://twitter.com/${hit.twitter.replace('@', '')}`}
              target="_blank"
              rel="noopener noreferrer"
            >
              <span className="at">@</span>
              {hit.twitter.replace('@', '')}
            </a>
          </TwitterHandle>
        )}
      </PersonDeets>
    </PersonWrapper>
  );
}

Person.propTypes = {
  currentTag: PropTypes.string,
  hit: PropTypes.shape({
    github: PropTypes.string,
    name: PropTypes.string,
    url: PropTypes.string,
    emoji: PropTypes.string,
    description: PropTypes.string,
    tags: PropTypes.arrayOf(PropTypes.string),
    country: PropTypes.string,
    computer: PropTypes.oneOf(['apple', 'windows', 'linux']),
    phone: PropTypes.oneOf(['iphone', 'android']),
    twitter(props, propName, componentName) {
      if (!/^@?(\w){1,15}$/.test(props[propName])) {
        return new Error(
          `Invalid prop \`${propName}\` supplied to` +
            ` \`${componentName}\`. This isn't a legit twitter handle.`
        );
      }
    },
  }),
};

// Component Styles
const PersonWrapper = styled.div`
  border: 1px solid var(--vape);
  border-radius: 5.34334px;
  box-shadow: 10px -10px 0 var(--blue2);
  display: grid;
  grid-template-rows: 1fr auto auto;
`;

const PersonInner = styled.div`
  padding: 2rem;
  h3 {
    margin: 0;
    a:visited {
      color: var(--purple);
    }
  }
  header {
    display: grid;
    grid-template-rows: auto auto;
    grid-template-columns: auto 1fr;
    grid-gap: 0 1rem;
    @media all and (max-width: 400px) {
      grid-template-columns: 1fr;
    }
    img {
      grid-row: 1 / -1;
      background: var(--lightblue);
      font-size: 1rem;
    }
    .displayLink {
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      text-decoration: none;
      color: var(--vape);
      letter-spacing: 1px;
      font-size: 1.2rem;
      text-overflow: ellipsis;
      max-width: 100%;
      overflow: hidden;
      :hover,
      :visited {
        color: var(--pink);
      }
    }
  }
`;

const PersonDeets = styled.div`
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
    &:first-child {
      border-left: 0;
    }
  }
  a {
    color: var(--vape);
  }
  .country {
    font-size: 3rem;
    padding-top: 2rem;
  }
  .phone {
    padding: 0;
  }
  @media all and (max-width: 400px) {
    display: grid;
    grid-template-columns: 1fr 1fr;
    > *:nth-child(1),
    > *:nth-child(2) {
      /* lol */
      border-bottom: 1px solid var(--vape);
    }
  }
`;

const TwitterHandle = styled.span`
  font-size: 1.24323423426928098420394802rem;
  .at {
    color: var(--yellow);
    margin-right: 2px;
  }
`;
