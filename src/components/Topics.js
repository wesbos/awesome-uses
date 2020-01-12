import React, { useContext } from 'react';
import PropTypes from 'prop-types';
import styled from 'styled-components';
import { connectMenu } from 'react-instantsearch-dom';

import FilterContext from '../context/FilterContext';
import * as icons from '../util/icons';

const Topics = ({ refine }) => {
  const { countries, tags, devices, currentTag, setCurrentTag } = useContext(
    FilterContext
  );
  return (
    <Tags>
      {tags.map((tag, index) => (
        <Tag
          currentTag={tag.name === currentTag}
          htmlFor={`filter-${tag.name}`}
          key={`filter-${tag.name}`}
          clickable
        >
          <input
            type="radio"
            name="tag"
            id={`filter-${tag.name}`}
            value={tag.name}
            checked={tag.name === currentTag}
            onChange={e => {
              if (index <= 0) {
                refine('');
              } else {
                refine(e.currentTarget.value);
              }
              setCurrentTag(e.currentTarget.value);
            }}
          />
          {tag.name}
          <TagCount>{tag.count}</TagCount>
        </Tag>
      ))}

      {countries.map(tag => (
        <Tag
          currentTag={tag.emoji === currentTag}
          htmlFor={`filter-${tag.name}`}
          key={`filter-${tag.name}`}
          title={tag.name}
          clickable
        >
          <input
            type="radio"
            name="tag"
            id={`filter-${tag.name}`}
            value={tag.emoji}
            checked={tag.emoji === currentTag}
            onChange={e => {
              refine(e.currentTarget.value);
              setCurrentTag(e.currentTarget.value);
            }}
          />
          <TagEmoji>{tag.emoji}</TagEmoji>
          <TagCount>{tag.count}</TagCount>
        </Tag>
      ))}

      {devices.map(tag => (
        <Tag
          currentTag={tag.name === currentTag}
          htmlFor={`filter-${tag.name}`}
          key={`filter-${tag.name}`}
          title={tag.name}
          clickable
        >
          <input
            type="radio"
            name="computer"
            id={`filter-${tag.name}`}
            value={tag.name}
            checked={tag.name === currentTag}
            onChange={e => {
              refine(e.currentTarget.value);
              setCurrentTag(e.currentTarget.value);
            }}
          />
          <img height="20px" src={icons[tag.name]} alt={tag.name} />
          <TagCount>{tag.count}</TagCount>
        </Tag>
      ))}
    </Tags>
  );
};

Topics.propTypes = {
  refine: PropTypes.func.isRequired,
};

export default connectMenu(Topics);

// Component Styles
export const Tags = styled.div`
  list-style-type: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-wrap: wrap;
`;

export const Tag = styled.label`
  background: var(--pink);
  margin: 2px;
  border-radius: 3px;
  font-size: ${props => (props.small ? '1.2rem' : '1.7rem')};
  padding: 5px;
  color: hsla(0, 100%, 100%, 0.8);
  transition: background-color 0.2s;
  cursor: ${props => (props.clickable ? 'pointer' : 'default')};
  display: grid;
  grid-template-columns: 1fr auto;
  align-items: center;
  input {
    display: none;
  }
  ${props =>
    props.currentTag &&
    `
    background: var(--yellow);
    color: hsla(0, 100%, 0%, 0.8);
  `}
`;

const TagEmoji = styled.span`
  transform: scale(1.45);
`;

const TagCount = styled.span`
  background: var(--blue);
  font-size: 1rem;
  color: white;
  padding: 2px;
  border-radius: 2px;
  margin-left: 5px;
`;