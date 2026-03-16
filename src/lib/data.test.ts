import { describe, expect, it } from 'vite-plus/test';
import {
  getAllPeople,
  getAllTags,
  getDirectoryData,
  getTagBySlug,
  getTagSlugByName,
  resolveLegacyTagInput,
} from './data';

describe('data indexing', () => {
  it('builds people and tag indexes', () => {
    const people = getAllPeople();
    const tags = getAllTags();
    expect(people.length).toBeGreaterThan(100);
    expect(tags.length).toBeGreaterThan(20);
  });

  it('resolves canonical tag slugs', () => {
    const reactSlug = getTagSlugByName('React.js');
    expect(reactSlug).toBeTruthy();
    expect(getTagBySlug(reactSlug as string)?.name).toBe('React');
  });

  it('applies directory filters', () => {
    const reactSlug = getTagSlugByName('React') as string;
    const data = getDirectoryData({ tag: reactSlug, q: 'developer' });
    expect(data.people.length).toBeGreaterThan(0);
    expect(data.people.every((person) => person.canonicalTags.includes('React'))).toBe(
      true
    );
  });

  it('maps legacy /like tags to canonical /like target', () => {
    const result = resolveLegacyTagInput('React.js');
    expect(result.redirectTo).toBe('/like/$tag');
    expect(result.params.tag).toBe('React');
  });
});
