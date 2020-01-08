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
        acc[country.name].count = acc[country.name].count + 1;
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
    .filter(([, count]) => count > 1)
    .map(([name, count]) => ({ name, count }));

  return [{ name: 'all', count: people.length }, ...tags];
}

export function computers() {
  const data = people
    .map(person => ({
      name: person.computer,
    }))
    .reduce((acc, computer) => {
      if (acc[computer.name]) {
        // exists, update
        acc[computer.name].count += 1;
      } else {
        acc[computer.name] = {
          ...computer,
          count: 1,
        };
      }
      return acc;
    }, {});

  const sorted = Object.entries(data)
    .map(([, computer]) => computer)
    .sort((a, b) => b.count - a.count);

  return sorted;
}

export function phones() {
  const data = people
    .map(person => ({
      name: person.phone,
    }))
    .reduce((acc, phone) => {
      if (acc[phone.name]) {
        // exists, update
        acc[phone.name].count = acc[phone.name].count + 1;
      } else {
        acc[phone.name] = {
          ...phone,
          count: 1,
        };
      }
      return acc;
    }, {});

  const sorted = Object.entries(data)
    .map(([, phone]) => phone)
    .sort((a, b) => b.count - a.count);

  return sorted;
}
