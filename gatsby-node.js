require('dotenv').config();
import algoliasearch from 'algoliasearch';

import people from './src/data.js';
import { tags, countries, devices } from './src/util/stats';

const client = algoliasearch('64JKWG60NQ', process.env.ALGOLIA_ADMIN_KEY);
const peopleIndex = client.initIndex('people');
const tempIndex = client.initIndex('temp');

function sourceNodes({ actions, createNodeId, createContentDigest }) {
  // Add People to the GraphQL API, we randomize the data on each build so no one gets their feelings hurt
  people
    .sort(() => Math.random() - 0.5)
    .forEach(person => {
      const nodeMeta = {
        id: createNodeId(`person-${person.name}`),
        parent: null,
        children: [],
        internal: {
          type: `Person`,
          mediaType: `text/html`,
          content: JSON.stringify(person),
          contentDigest: createContentDigest(person),
        },
      };

      actions.createNode({ ...person, ...nodeMeta });
    });

  // Add tags to GraphQL API
  tags().forEach(tag => {
    const nodeMeta = {
      id: createNodeId(`tag-${tag.name}`),
      parent: null,
      children: [],
      internal: {
        type: `Tag`,
        mediaType: `text/html`,
        content: JSON.stringify(tag),
        contentDigest: createContentDigest(tag),
      },
    };

    actions.createNode({ ...tag, ...nodeMeta });
  });

  // Add Countries to GraphQL API
  countries().forEach(country => {
    const nodeMeta = {
      id: createNodeId(`country-${country.name}`),
      parent: null,
      children: [],
      internal: {
        type: `Country`,
        mediaType: `text/html`,
        content: JSON.stringify(country),
        contentDigest: createContentDigest(country),
      },
    };

    actions.createNode({ ...country, ...nodeMeta });
  });

  // Add Devices to GraphQL API
  console.log(devices());
  devices().forEach(device => {
    const nodeMeta = {
      id: createNodeId(`device-${device.name}`),
      parent: null,
      children: [],
      internal: {
        type: `device`,
        mediaType: `text/html`,
        content: JSON.stringify(device),
        contentDigest: createContentDigest(device),
      },
    };
    actions.createNode({ ...device, ...nodeMeta });
  });

  // Algolia reindex data
  client
    .copyIndex(peopleIndex.indexName, tempIndex.indexName, [
      'settings',
      'synonyms',
      'rules',
    ])
    .then(({ taskID }) => tempIndex.waitTask(taskID))
    .then(() => {
      const objects = people.map(person => ({
        ...person,
        filterAttributes: [
          ...person.tags,
          person.country,
          person.phone,
          person.computer,
        ],
      }));
      return tempIndex.addObjects(objects);
    })
    .then(({ taskID }) => tempIndex.waitTask(taskID))
    .then(() => client.moveIndex(tempIndex.indexName, peopleIndex.indexName))
    .catch(err => console.error(err));
}

export { sourceNodes };
