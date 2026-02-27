import { describe, expect, it } from 'vitest';
import { buildNextPeopleAfterCull } from './cull';
import type { PersonRecord } from '../../src/lib/types';

const PEOPLE: PersonRecord[] = [
  {
    name: 'A',
    description: 'A',
    url: 'https://a.dev/uses',
    country: '🇨🇦',
    tags: ['React'],
  },
  {
    name: 'B',
    description: 'B',
    url: 'https://b.dev/uses',
    country: '🇺🇸',
    tags: ['Vue'],
  },
  {
    name: 'C',
    description: 'C',
    url: 'https://c.dev/uses',
    country: '🇩🇪',
    tags: ['Svelte'],
  },
];

describe('buildNextPeopleAfterCull', () => {
  it('removes only checked failures and keeps unchecked people', () => {
    const result = buildNextPeopleAfterCull(PEOPLE, [
      { url: 'https://a.dev/uses', ok: true },
      { url: 'https://b.dev/uses', ok: false },
    ]);

    expect(result.nextPeople.map((person) => person.url)).toEqual([
      'https://a.dev/uses',
      'https://c.dev/uses',
    ]);
    expect(result.removedCount).toBe(1);
  });

  it('keeps all people when no checks provided', () => {
    const result = buildNextPeopleAfterCull(PEOPLE, []);
    expect(result.nextPeople).toHaveLength(3);
    expect(result.removedCount).toBe(0);
  });
});
