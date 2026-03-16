import { describe, expect, it } from 'vite-plus/test';
import { sqlValue } from './scrape';

describe('sqlValue', () => {
  it('escapes apostrophes', () => {
    expect(sqlValue("it's me")).toBe("'it''s me'");
  });

  it('returns NULL for null', () => {
    expect(sqlValue(null)).toBe('NULL');
  });

  it('returns number as string', () => {
    expect(sqlValue(42)).toBe('42');
  });

  it('returns NULL for NaN', () => {
    expect(sqlValue(NaN)).toBe('NULL');
  });

  it('returns NULL for Infinity', () => {
    expect(sqlValue(Infinity)).toBe('NULL');
  });
});
