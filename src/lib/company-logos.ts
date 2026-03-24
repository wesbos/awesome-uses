export type CompanyLogo = {
  key: string;
  name: string;
  logoUrl: string;
  aliases: string[];
};

const KNOWN_COMPANIES: CompanyLogo[] = [
  {
    key: 'google',
    name: 'Google',
    logoUrl: 'https://cdn.simpleicons.org/google',
    aliases: ['google'],
  },
  {
    key: 'cloudflare',
    name: 'Cloudflare',
    logoUrl: 'https://cdn.simpleicons.org/cloudflare',
    aliases: ['cloudflare'],
  },
  {
    key: 'github',
    name: 'GitHub',
    logoUrl: 'https://cdn.simpleicons.org/github',
    aliases: ['github'],
  },
  {
    key: 'vercel',
    name: 'Vercel',
    logoUrl: 'https://cdn.simpleicons.org/vercel',
    aliases: ['vercel'],
  },
  {
    key: 'netlify',
    name: 'Netlify',
    logoUrl: 'https://cdn.simpleicons.org/netlify',
    aliases: ['netlify'],
  },
  {
    key: 'clerk',
    name: 'Clerk',
    logoUrl: 'https://cdn.simpleicons.org/clerk',
    aliases: ['clerk'],
  },
  {
    key: 'auth0',
    name: 'Auth0',
    logoUrl: 'https://cdn.simpleicons.org/auth0',
    aliases: ['auth0'],
  },
  {
    key: 'laracasts',
    name: 'Laracasts',
    logoUrl: 'https://cdn.simpleicons.org/laravel',
    aliases: ['laracasts'],
  },
  {
    key: 'aws',
    name: 'AWS',
    logoUrl: 'https://cdn.simpleicons.org/amazonaws',
    aliases: ['aws', 'amazon web services', 'amazon'],
  },
  {
    key: 'microsoft',
    name: 'Microsoft',
    logoUrl: 'https://cdn.simpleicons.org/microsoft',
    aliases: ['microsoft'],
  },
  {
    key: 'meta',
    name: 'Meta',
    logoUrl: 'https://cdn.simpleicons.org/meta',
    aliases: ['meta', 'facebook'],
  },
  {
    key: 'spotify',
    name: 'Spotify',
    logoUrl: 'https://cdn.simpleicons.org/spotify',
    aliases: ['spotify'],
  },
];

function normalize(input: string): string {
  return input.trim().toLowerCase();
}

export function getCompanyLogo(companyName: string): CompanyLogo | null {
  const needle = normalize(companyName);
  if (!needle) return null;

  return (
    KNOWN_COMPANIES.find((company) =>
      company.aliases.some((alias) => normalize(alias) === needle)
    ) || null
  );
}

export function extractCompaniesFromText(input: string): CompanyLogo[] {
  const text = normalize(input);
  if (!text) return [];

  const matched = KNOWN_COMPANIES.filter((company) =>
    company.aliases.some((alias) => {
      const escaped = alias.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const regex = new RegExp(`\\b${escaped}\\b`, 'i');
      return regex.test(text);
    })
  );

  return matched.sort((a, b) => a.name.localeCompare(b.name));
}

export function getKnownCompanies(): CompanyLogo[] {
  return KNOWN_COMPANIES;
}
