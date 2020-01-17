import { name } from 'country-emoji';
import people from '../data.js';

function merge(prop) {
  return function(acc, obj) {
    return [...obj[prop], ...acc];
  };
}

function countInstances(acc, tag) {
  acc[tag] = acc[tag] ? acc[tag] + 1 : 1;
  return acc;
}

export function countries() {
  const data = people
    .map(person => ({
      name: name(person.country),
      emoji: person.country,
    }))
    .reduce((acc, country) => {
      if (acc[country.name]) {
        // exists, update
        acc[country.name].count += acc[country.name].count;
      } else {
        acc[country.name] = {
          ...country,
          count: 1,
        };
      }
      return acc;
    }, {});

  const sorted = Object.entries(data)
    .map(([, country]) => country)
    .sort((a, b) => b.count - a.count);

  return sorted;
}

export function tags() {
  const allTags = people.reduce(merge('tags'), []);
  const counts = allTags.reduce(countInstances, {});
  // sort and filter for any tags that only have 1
  const tags = Object.entries(counts)
    .sort(([, countA], [, countB]) => countB - countA)
    // Only show the tag if this topic has 3 or more people in it
    .filter(([, count]) => count >= 3)
    .map(([name, count]) => ({ name, count }));

  return [{ name: 'all', count: people.length }, ...tags];
}

export function devices() {
  const all = [
    ...people.map(person => person.computer),
    ...people.map(person => person.phone),
  ];

  return Object.entries(all.reduce(countInstances, {}))
    .map(([device, count]) => ({ name: device, count }))
    .sort((a, b) => b.count - a.count);
}
