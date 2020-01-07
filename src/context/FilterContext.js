import React, { createContext, useState } from 'react';
import { useStaticQuery, graphql } from 'gatsby';

const FilterContext = createContext();

const FilterProvider = function({ children }) {
  const [currentTag, setCurrentTag] = useState('all');

  const { allTag, allCountry } = useStaticQuery(graphql`
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
    }
  `);
  return (
    <FilterContext.Provider
      value={{
        tags: allTag.nodes,
        countries: allCountry.nodes,
        currentTag,
        setCurrentTag,
      }}
    >
      {children}
    </FilterContext.Provider>
  );
};

export default FilterContext;
export { FilterProvider };
