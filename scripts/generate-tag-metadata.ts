import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import { loadPeopleFromDataJs } from './lib/data-file';

function normalizeKey(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/[^a-z0-9]+/g, '');
}

function titleCase(value: string): string {
  return value
    .trim()
    .replace(/\s+/g, ' ')
    .split(' ')
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

const PREFERRED_CANONICAL_BY_KEY: Record<string, string> = {
  react: 'React',
  reactjs: 'React',
  next: 'Next.js',
  nextjs: 'Next.js',
  vue: 'Vue.js',
  vuejs: 'Vue.js',
  node: 'Node.js',
  nodejs: 'Node.js',
  javascript: 'JavaScript',
  typescript: 'TypeScript',
  tailwind: 'Tailwind CSS',
  tailwindcss: 'Tailwind CSS',
};

function pickCanonical(normalizedKey: string, variants: string[]): string {
  const preferredCanonical = PREFERRED_CANONICAL_BY_KEY[normalizedKey];
  if (preferredCanonical) {
    return preferredCanonical;
  }

  const sorted = [...variants].sort((a, b) => {
    if (b.length !== a.length) return b.length - a.length;
    return a.localeCompare(b);
  });
  const preferred = sorted.find((variant) =>
    /(js|css|api|ui|ux|ai)/i.test(variant)
  );
  return titleCase(preferred || sorted[0] || 'Unknown');
}

function assignGroup(tag: string): string {
  const lowered = tag.toLowerCase();
  if (/(react|vue|svelte|next|css|html|frontend|front end|tailwind)/.test(lowered)) {
    return 'frontend';
  }
  if (/(node|backend|api|php|python|go|laravel|graphql|database|sql)/.test(lowered)) {
    return 'backend';
  }
  if (/(git|github|docker|linux|vim|vscode|testing|ci|devops)/.test(lowered)) {
    return 'tooling';
  }
  return 'general';
}

async function main() {
  const people = await loadPeopleFromDataJs();
  const rawTags = people.flatMap((person) => person.tags || []);

  const variantsByNormalized = rawTags.reduce<Map<string, Set<string>>>((acc, tag) => {
    const key = normalizeKey(tag);
    if (!key) return acc;
    if (!acc.has(key)) acc.set(key, new Set());
    acc.get(key)?.add(tag);
    return acc;
  }, new Map());

  const aliasMap: Record<string, string> = {};
  const grouped: Record<string, Set<string>> = {
    frontend: new Set(),
    backend: new Set(),
    tooling: new Set(),
    general: new Set(),
  };

  for (const [normalizedKey, variantsSet] of variantsByNormalized) {
    const variants = Array.from(variantsSet);
    const canonical = pickCanonical(normalizedKey, variants);
    for (const variant of variants) {
      aliasMap[normalizeKey(variant)] = canonical;
    }
    grouped[assignGroup(canonical)].add(canonical);
  }

  const groupOutput = Object.entries(grouped).map(([slug, tags]) => ({
    slug,
    name: titleCase(slug),
    tags: Array.from(tags).sort((a, b) => a.localeCompare(b)),
  }));

  const aliasesPath = path.resolve(process.cwd(), 'src/generated/tag-aliases.json');
  const groupsPath = path.resolve(process.cwd(), 'src/generated/tag-groups.json');

  await writeFile(aliasesPath, `${JSON.stringify(aliasMap, null, 2)}\n`, 'utf8');
  await writeFile(groupsPath, `${JSON.stringify(groupOutput, null, 2)}\n`, 'utf8');

  console.log(`Generated ${Object.keys(aliasMap).length} aliases.`);
  console.log(`Generated ${groupOutput.length} groups.`);
}

void main();
