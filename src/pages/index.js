import React, { useContext } from 'react';
import { useStaticQuery, graphql } from 'gatsby';
import FilterContext from '../context/FilterContext';

import Layout from '../components/layout';
import Person from '../components/Person';
import Topics from '../components/Topics';

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
      <div className="people">
        {people.map(person => (
          <Person key={person.name} person={person} currentTag={currentTag} />
        ))}
      </div>
    </Layout>
  );
}

export default IndexPage;
