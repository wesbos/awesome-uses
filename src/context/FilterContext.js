import React, { createContext, useState } from 'react';
import { useStaticQuery, graphql } from 'gatsby';

const FilterContext = createContext();

const FilterProvider = function({ children }) {
  const [currentTag, setCurrentTag] = useState('all');

  const { allTag, allCountry, allComputer, allPhone } = useStaticQuery(graphql`
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
      allComputer {
        nodes {
          count
          name
        }
      }
      allPhone {
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
        computers: allComputer.nodes,
        phones: allPhone.nodes,
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
