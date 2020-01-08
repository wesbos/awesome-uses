import people from './src/data.js';
import { tags, countries, computers, phones } from './src/util/stats';

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

  console.log(countries());
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

  console.log(computers());

  // Add Phones to GraphQL API
  computers().forEach(computer => {
    const nodeMeta = {
      id: createNodeId(`computer-${computer.name}`),
      parent: null,
      children: [],
      internal: {
        type: `Computer`,
        mediaType: `text/html`,
        content: JSON.stringify(computer),
        contentDigest: createContentDigest(computer),
      },
    };
    actions.createNode({ ...computer, ...nodeMeta });
  });

  console.log(phones());

  // Add Phones to GraphQL API
  phones().forEach(phone => {
    const nodeMeta = {
      id: createNodeId(`phone-${phone.name}`),
      parent: null,
      children: [],
      internal: {
        type: `Phone`,
        mediaType: `text/html`,
        content: JSON.stringify(phone),
        contentDigest: createContentDigest(phone),
      },
    };
    actions.createNode({ ...phone, ...nodeMeta });
  });
}

export { sourceNodes };
