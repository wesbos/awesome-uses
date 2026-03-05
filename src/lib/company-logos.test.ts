import { describe, expect, it } from 'vitest';
import { extractCompaniesFromText, getCompanyLogo } from './company-logos';

describe('company logo helpers', () => {
  it('resolves known company logo by alias', () => {
    const logo = getCompanyLogo('github');
    expect(logo?.name).toBe('GitHub');
    expect(logo?.logoUrl).toContain('simpleicons');
  });

  it('extracts unique company matches from text', () => {
    const companies = extractCompaniesFromText(
      'Developer Advocate at Cloudflare, previously at Google and github.'
    );
    expect(companies.map((company) => company.name)).toEqual([
      'Cloudflare',
      'GitHub',
      'Google',
    ]);
  });
});
