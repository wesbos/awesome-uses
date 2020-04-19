import React, { createContext, useState } from 'react';
import { useStaticQuery, graphql } from 'gatsby';
import PropTypes from 'prop-types';

const FilterContext = createContext();

const FilterProvider = function({ children }) {
  const [currentTag, setCurrentTag] = useState('all');

  const { allTag, allCountry, allDevice } = useStaticQuery(graphql`
    query FilterQuery {
      allTag {
        nodes {
          name
          count
        }
      }
      allCountry {
        nodes {
          count
          emoji
          name
        }
      }
      allDevice {
        nodes {
          count
          name
        }
      }
    }
  `);
  return (
    <FilterContext.Provider
      value={{
        tags: allTag.nodes,
        countries: allCountry.nodes,
        devices: allDevice.nodes,
        currentTag,
        setCurrentTag,
      }}
    >
      {children}
    </FilterContext.Provider>
  );
};

FilterProvider.propTypes = {
  children: PropTypes.element,
};

export default FilterContext;
export { FilterProvider };
