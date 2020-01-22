import React, { useContext } from 'react';
import { useStaticQuery, graphql } from 'gatsby';
import styled from 'styled-components';
import FilterContext from '../context/FilterContext';

import Layout from '../components/layout';
import Person from '../components/Person';
import Topics from '../components/Topics';

const BackToTopLink = styled.a`
  position: fixed;
  bottom: 1%;
  right: 1%;
  background: var(--pink);
  cursor: pointer;
  border-radius: 3px;
  padding: 1rem;
  transition: background-color 0.2s ease 0s;
`;

function IndexPage() {
  const { currentTag } = useContext(FilterContext);
  const { allPerson } = useStaticQuery(graphql`
    query People {
      allPerson {
        nodes {
          computer
          country
          description
          emoji
          id
          name
          phone
          tags
          twitter
          url
        }
      }
    }
  `);
  const people = allPerson.nodes.filter(
    person =>
      currentTag === 'all' ||
      person.tags.includes(currentTag) ||
      currentTag === person.country ||
      currentTag === person.computer ||
      currentTag === person.phone
  );
  return (
    <Layout>
      <Topics />
      <People>
        {people.map(person => (
          <Person key={person.name} person={person} currentTag={currentTag} />
        ))}
      </People>
      <BackToTopLink href="#top">&uarr; Back to top</BackToTopLink>
    </Layout>
  );
}

export default IndexPage;

// Component Styles
const People = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(350px, 1fr));
  grid-gap: 5rem;
  @media all and (max-width: 400px) {
    grid-template-columns: 1fr;
  }
`;
