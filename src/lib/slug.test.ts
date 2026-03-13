import { describe, expect, it } from 'vitest';
import { buildUniqueSlug, slugify } from './slug';

describe('slug helpers', () => {
  it('slugify normalizes punctuation and case', () => {
    expect(slugify('React.js & Next.js')).toBe('react-js-next-js');
  });

  it('buildUniqueSlug handles collisions deterministically', () => {
    const used = new Set<string>();
    expect(buildUniqueSlug('Jane Doe', used, 'person')).toBe('jane-doe');
    expect(buildUniqueSlug('Jane Doe', used, 'person')).toBe('jane-doe-2');
    expect(buildUniqueSlug('Jane Doe', used, 'person')).toBe('jane-doe-3');
  });
});
