import React from 'react';
import algoliasearch from 'algoliasearch/lite';
import { InstantSearch } from 'react-instantsearch-dom';

import Layout from '../components/layout';
import PeopleHits from '../components/PeopleHits';
import Topics from '../components/Topics';

const searchClient = algoliasearch(
  '64JKWG60NQ',
  'd71db2d423187ffe5dcd0427070cd81d'
);

function IndexPage() {
  return (
    <Layout>
      <InstantSearch indexName="people" searchClient={searchClient}>
        <Topics attribute="filterAttributes" limit={300} />
        <PeopleHits />
      </InstantSearch>
    </Layout>
  );
}

export default IndexPage;
