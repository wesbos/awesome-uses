import React, { useContext } from 'react';
import PropTypes from 'prop-types';
import styled from 'styled-components';
import { connectHits } from 'react-instantsearch-dom';

import FilterContext from '../context/FilterContext';

import Person from './Person';

const PeopleHits = ({ hits }) => {
  const { currentTag } = useContext(FilterContext);
  return (
    <People>
      {hits.map(hit => (
        <Person key={hit.objectID} hit={hit} currentTag={currentTag} />
      ))}
    </People>
  );
};

PeopleHits.propTypes = {
  hits: PropTypes.arrayOf(
    PropTypes.shape({
      objectID: PropTypes.string.isRequired,
      name: PropTypes.string.isRequired,
      description: PropTypes.string.isRequired,
      url: PropTypes.string.isRequired,
      twitter: PropTypes.string,
      emoji: PropTypes.string,
      country: PropTypes.string.isRequired,
      computer: PropTypes.string,
      phone: PropTypes.string,
      tags: PropTypes.arrayOf(PropTypes.string).isRequired,
      _highlightResult: PropTypes.any,
    }).isRequired
  ).isRequired,
};

export default connectHits(PeopleHits);

// Component Styles
const People = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(350px, 1fr));
  grid-gap: 5rem;
  @media all and (max-width: 400px) {
    grid-template-columns: 1fr;
  }
`;
