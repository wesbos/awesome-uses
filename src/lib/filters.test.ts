import { describe, expect, it } from 'vite-plus/test';
import { normalizeFilters, parseDirectorySearch } from './filters';

describe('directory filter parsing', () => {
  it('parses valid search params', () => {
    const parsed = parseDirectorySearch({
      tag: 'react',
      country: '🇨🇦',
      device: 'iphone',
      q: 'design systems',
    });

    expect(parsed).toEqual({
      tag: 'react',
      country: '🇨🇦',
      device: 'iphone',
      q: 'design systems',
    });
  });

  it('drops empty query values', () => {
    const parsed = parseDirectorySearch({
      tag: '  ',
      country: '',
      q: '   ',
    });

    expect(parsed).toEqual({
      tag: undefined,
      country: undefined,
      device: undefined,
      q: undefined,
    });
  });

  it('normalizes empty filters consistently', () => {
    expect(
      normalizeFilters({
        tag: '',
        country: '',
        q: '   ',
      })
    ).toEqual({
      tag: undefined,
      country: undefined,
      device: undefined,
      q: undefined,
    });
  });
});
