import React, { useContext } from 'react';
import FilterContext from '../context/FilterContext';

export default function Topics() {
  const {
    countries,
    tags,
    phones,
    computers,
    currentTag,
    setCurrentTag,
  } = useContext(FilterContext);
  console.log(countries);
  return (
    <div className="tags">
      {tags.map(tag => (
        <label
          className={`tag ${tag.name === currentTag ? 'currentTag' : ''}`}
          htmlFor={`filter-${tag.name}`}
          key={`filter-${tag.name}`}
        >
          <input
            type="radio"
            name="tag"
            id={`filter-${tag.name}`}
            value={tag.name}
            checked={tag.name === currentTag}
            onChange={e => setCurrentTag(e.currentTarget.value)}
          />
          {tag.name}
          <span className="count">{tag.count}</span>
        </label>
      ))}

      {countries.map(tag => (
        <label
          className={`tag ${tag.emoji === currentTag ? 'currentTag' : ''}`}
          htmlFor={`filter-${tag.name}`}
          key={`filter-${tag.name}`}
          title={tag.name}
        >
          <input
            type="radio"
            name="tag"
            id={`filter-${tag.name}`}
            value={tag.emoji}
            checked={tag.emoji === currentTag}
            onChange={e => setCurrentTag(e.currentTarget.value)}
          />
          <span className="emoji">{tag.emoji}</span>
          <span className="count">{tag.count}</span>
        </label>
      ))}
      {computers.map(tag => (
        <label
          className={`tag ${tag.name === currentTag ? 'currentTag' : ''}`}
          htmlFor={`filter-${tag.name}`}
          key={`filter-${tag.name}`}
          title={tag.name}
        >
          <input
            type="radio"
            name="computer"
            id={`filter-${tag.name}`}
            value={tag.name}
            checked={tag.name === currentTag}
            onChange={e => setCurrentTag(e.currentTarget.value)}
          />
          {tag.name}
          <span className="count">{tag.count}</span>
        </label>
      ))}
      {phones.map(tag => (
        <label
          className={`tag ${tag.name === currentTag ? 'currentTag' : ''}`}
          htmlFor={`filter-${tag.name}`}
          key={`filter-${tag.name}`}
          title={tag.name}
        >
          <input
            type="radio"
            name="tag"
            id={`filter-${tag.name}`}
            value={tag.name}
            checked={tag.name === currentTag}
            onChange={e => setCurrentTag(e.currentTarget.value)}
          />
          {tag.name}
          <span className="count">{tag.count}</span>
        </label>
      ))}
    </div>
  );
}
