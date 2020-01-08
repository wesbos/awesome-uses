import React from 'react';
import { name } from 'country-emoji';
import styled from 'styled-components';
import { Tag, Tags } from './Topics';
import iphone from '../images/iphone.png';
import android from '../images/android.png';
import windows from '../images/windows.svg';
import apple from '../images/apple.svg';
import ubuntu from '../images/ubuntu.svg';

const icons = { iphone, android, windows, apple, ubuntu };
export default function Person({ person, currentTag }) {
  const url = new URL(person.url);
  const img = `https://logo.clearbit.com/${url.host}`;
  return (
    <PersonWrapper>
      <PersonInner>
        <header>
          <img width="50" height="50" src={img} alt={person.name} />
          <h3>
            <a href={person.url} target="_blank" rel="noopener noreferrer">
              {person.name} {person.emoji}
            </a>
          </h3>
          <a
            className="displayLink"
            href={person.url}
          >{`${url.host}${url.pathname}`}</a>
        </header>
        <p>{person.description}</p>
        <Tags>
          {person.tags.map(tag => (
            <Tag key={tag} as="li" currentTag={tag === currentTag} small>
              {tag}
            </Tag>
          ))}
        </Tags>
      </PersonInner>
      <PersonDeets>
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
          <span>
            <a
              href={`https://twitter.com/${person.twitter}`}
              target="_blank"
              rel="noopener noreferrer"
            >
              <span className="at">@</span>
              {person.twitter.replace('@', '')}
            </a>
          </span>
        )}
        {person.github && <span>{person.github}</span>}
      </PersonDeets>
    </PersonWrapper>
  );
}

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
  }
  header {
    display: grid;
    grid-template-rows: auto auto;
    grid-template-columns: auto 1fr;
    grid-gap: 0 1rem;
    img {
      grid-row: 1 / -1;
      background: var(--lightblue);
      font-size: 1rem;
    }
    .displayLink {
      text-decoration: none;
      color: var(--vape);
      letter-spacing: 1px;
      font-size: 1.2rem;
      :hover {
        color: var(--pink);
      }
    }
  }
`;

const PersonDeets = styled.div`
  display: flex;
  border-block-start: 1px solid var(--vape);
  > * {
    flex: 1;
    border-inline-start: 1px solid var(--vape);
    text-align: center;
    padding: 1rem;
    display: grid;
    align-items: center;
    justify-content: center;
    grid-template-columns: auto auto;
  }
  a {
    color: var(--vape);
  }
  :first-child {
    border-inline-start: none;
  }
  .at {
    color: var(--yellow);
    margin-right: 2px;
  }
  .country {
    font-size: 3rem;
  }
  .phone {
    padding: 0;
  }
`;
