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

export function normalizeTag(tag) {
  return (
    tag
      // Common mispellings currently seen in the data
      // Do we want to go this far?
      .replace(/frontend/i, 'Front End')
      .replace(/backend/i, 'Back End')
      .replace(/fullstack/i, 'Full Stack')
      .replace(/a11y/i, 'Accessibility')
      .replace(/next.?js/i, 'Next')
      .replace(/react.?js/i, 'React')

      // Or is lowercase enough?
      .toLowerCase()
  );
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
        acc[country.name].count += 1;
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

  const lowercaseTagMap = tags.reduce((acc, tag) => {
    const normalizedName = normalizeTag(tag.name);
    const currentCount = acc[normalizedName] || 0;
    acc[normalizedName] = currentCount + tag.count;
    return acc;
  }, {});

  // Merge tags like "JavaScript" and "Javascript" based on the
  // count… Event though it's obviously JavaScript!
  const normalizedTags = tags.reduce((acc, { name }) => {
    const normalizedName = normalizeTag(name);
    if (typeof lowercaseTagMap[normalizedName] !== 'undefined') {
      acc.push({ name, count: lowercaseTagMap[normalizedName] });
      delete lowercaseTagMap[normalizedName];
    }
    return acc;
  }, []);

  return [{ name: 'all', count: people.length }, ...normalizedTags];
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
