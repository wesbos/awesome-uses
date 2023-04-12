import { name } from 'country-emoji';
import people from '../data.js';
type Person = typeof people[0];

function merge(prop: string) {
  return function (acc: any, obj: Record<any, any>) {
    // Remove duplicated values.
    const values = [...new Set(obj[prop])];
    return [...values, ...acc];
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
      .replace(/TailwindCSS/i, 'Tailwind CSS')
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
    .map((person) => ({
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
    .sort((a, b) => b.count - a.count)
    .filter(Boolean);

  return sorted;
}

export function tags() {
  const allTags = people.reduce(merge('tags'), []);
  const counts = allTags.reduce(countInstances, {});
  // sort and filter for any tags that only have 1
  const tags = Object.entries(counts)
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
  }, [])
    // Sort by name first
    .sort((a, b) => b.name.toLowerCase() > a.name.toLowerCase())
    // Sort by count
    .sort((a, b) => b.count - a.count);
  return [{ name: 'all', count: people.length }, ...normalizedTags];
}

export function devices() {

  const all = [
    ...people.map((person) => person.computer),
    ...people.map((person) => person.phone),
  ].filter(Boolean);

  return Object.entries(all.reduce(countInstances, {}))
    .map(([device, count]) => ({ name: device, count }))
    .sort((a, b) => b.count - a.count)
    .map((device) => {
      return device;
    })
}

function unique(arr: string[]) {
  return Array.from(new Set(arr));
}

const normalizedTagMap = tags().reduce((acc, tag) => {
  const normalizedTag = normalizeTag(tag.name);
  acc[normalizedTag] = tag.name;
  return acc;
}, {});

export function getPeople(tag?: string) {
  return [...people]
    .sort(() => Math.random() - 0.5)
    .map((person) => {
      const normalizedPerson = {
        ...person,
        // Clean out people that added basically the same tags twice
        tags: unique(
          person.tags.map((tag) => normalizedTagMap[normalizeTag(tag)] || tag)
        ),
      };
      return {
        ...normalizedPerson,
        id: `person-${normalizedPerson.name}`,
      };
    })
    .filter((person) => {
      if (!tag) {
        return true;
      }
      return person.tags.includes(tag) || person.country === tag || person.phone === tag || person.computer === tag;
    })

}
