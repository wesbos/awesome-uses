import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

/**
 * Phase 2: Review discovered tags and produce a canonical tag list.
 *
 * Reads discovery-results.json, applies merge rules to collapse synonyms,
 * drops rare/noisy tags, and writes src/generated/item-tags.json.
 *
 * After running, review item-tags.json and hand-edit if needed before
 * doing the full extraction pass (Phase 3).
 */

// Merge rules: key = alias, value = canonical tag it maps to
const MERGE_RULES: Record<string, string> = {
  'ide': 'editor',
  'code': 'editor',
  'vscode': 'editor',
  'text-editor': 'editor',
  'code-editor': 'editor',
  'vscode-extension': 'editor-extension',
  'neovim-plugin': 'editor-extension',
  'browser-extension': 'browser-extension',
  'extension': 'editor-extension',
  'cli': 'terminal',
  'shell': 'terminal',
  'zsh': 'terminal',
  'earbuds': 'headphones',
  'display': 'monitor',
  '27-inch': 'monitor',
  'macos': 'mac',
  'ios': 'mobile',
  'iphone': 'mobile',
  'ipad': 'tablet',
  'mouse': 'pointing-device',
  'trackpad': 'pointing-device',
  'trackball': 'pointing-device',
  'mechanical': 'keyboard',
  'keycaps': 'keyboard',
  'webcam': 'camera',
  'mount': 'stand',
  'laptop-stand': 'stand',
  'monitor-arm': 'stand',
  'boom-arm': 'stand',
  'dock': 'hub',
  'thunderbolt': 'hub',
  'usb-c': 'hub',
  'password-manager': 'security',
  'version-control': 'git',
  'github': 'git',
  'self-hosted': 'hosting',
  'deployment': 'hosting',
  'cdn': 'hosting',
  'messaging': 'chat',
  'communication': 'chat',
  'collaboration': 'chat',
  'stationery': 'office',
  'pen': 'office',
  'stylus': 'office',
  'protective': 'case',
  'protection': 'case',
  'sleeve': 'case',
  'cpu': 'computer',
  'gpu': 'computer',
  'desktop': 'computer',
  'laptop': 'computer',
  'language': 'programming',
  'javascript': 'programming',
  'php': 'programming',
  'python': 'programming',
  'css': 'programming',
  'frontend': 'programming',
  'development': 'programming',
  'framework': 'programming',
  'tailwind': 'programming',
  'wordpress': 'programming',
  'sql': 'database',
  'notes': 'note-taking',
  'wearable': 'wearable',
  'charger': 'power',
  'cable': 'power',
};

// Minimum count from discovery to include a tag
const MIN_COUNT = 5;

type DiscoveryResults = {
  topTags: Record<string, number>;
};

async function main() {
  const discoveryPath = path.resolve(process.cwd(), 'src/generated/discovery-results.json');
  const raw = await readFile(discoveryPath, 'utf8');
  const discovery: DiscoveryResults = JSON.parse(raw);

  // Apply merges and aggregate counts
  const merged = new Map<string, number>();
  for (const [tag, count] of Object.entries(discovery.topTags)) {
    const canonical = MERGE_RULES[tag] || tag;
    merged.set(canonical, (merged.get(canonical) || 0) + count);
  }

  // Filter by minimum count and sort
  const tags = [...merged.entries()]
    .filter(([, count]) => count >= MIN_COUNT)
    .sort((a, b) => b[1] - a[1])
    .map(([tag, count]) => ({ tag, count }));

  // Build the alias map (for the extraction prompt)
  const aliasMap: Record<string, string> = {};
  for (const [alias, canonical] of Object.entries(MERGE_RULES)) {
    aliasMap[alias] = canonical;
  }

  const output = {
    generatedAt: new Date().toISOString(),
    totalCanonicalTags: tags.length,
    tags: tags.map((t) => t.tag),
    tagCounts: Object.fromEntries(tags.map((t) => [t.tag, t.count])),
    aliasMap,
  };

  const outPath = path.resolve(process.cwd(), 'src/generated/item-tags.json');
  await writeFile(outPath, JSON.stringify(output, null, 2) + '\n', 'utf8');

  console.log(`Canonical tags: ${tags.length}`);
  console.log('');
  for (const { tag, count } of tags) {
    console.log(`  ${tag.padEnd(25)} ${count}`);
  }
  console.log(`\nWritten to ${outPath}`);
  console.log('\nReview and hand-edit item-tags.json, then run the full extraction pass.');
}

void main();
