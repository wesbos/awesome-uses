import React from 'react';
import { name } from 'country-emoji';
import iphone from '../images/iphone.png';
import android from '../images/android.png';
import windows from '../images/windows.svg';
import apple from '../images/apple.svg';

const icons = { iphone, android, windows, apple };
export default function Person({ person, currentTag }) {
  const url = new URL(person.url);
  const img = `https://logo.clearbit.com/${url.host}`;
  return (
    <div className="person">
      <div className="personInner">
        <img width="50" src={img} alt={person.name} />
        <h3>
          <a href={person.url} target="_blank" rel="noopener noreferrer">
            {person.name} {person.emoji}
          </a>
        </h3>
        <a
          className="displayLink"
          href={person.url}
        >{`${url.host}${url.pathname}`}</a>
        <p>{person.description}</p>

        <ul className="tags">
          {person.tags.map(tag => (
            <li
              key={tag}
              className={`tag ${tag === currentTag ? 'currentTag' : ''}`}
            >
              {tag}
            </li>
          ))}
        </ul>
      </div>
      <div className="deets">
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
      </div>
    </div>
  );
}
