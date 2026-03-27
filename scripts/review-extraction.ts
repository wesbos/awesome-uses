/**
 * @deprecated Use the dashboard UI at /dashboard instead.
 * The "Extraction Review" card provides the same quality report via
 * $getExtractionReview.
 */
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

type ItemRow = {
  person_slug: string;
  item: string;
  tags_json: string;
  detail: string | null;
};

async function queryLocalD1(sql: string): Promise<ItemRow[]> {
  const { stdout } = await execFileAsync('npx', [
    'wrangler', 'd1', 'execute', 'uses-tech-scrapes',
    '--local', '--json', '--command', sql,
  ], { cwd: process.cwd(), maxBuffer: 50 * 1024 * 1024 });

  const parsed = JSON.parse(stdout);
  return parsed[0]?.results ?? [];
}

async function main() {
  const rows = await queryLocalD1(
    `SELECT person_slug, item, tags_json, detail FROM person_items ORDER BY item`
  );

  if (rows.length === 0) {
    console.log('No items in person_items. Run extract first.');
    return;
  }

  // Group by tag
  const tagItems = new Map<string, Map<string, { count: number; people: Set<string> }>>();

  for (const row of rows) {
    let tags: string[];
    try {
      tags = JSON.parse(row.tags_json);
    } catch {
      tags = ['unknown'];
    }

    for (const tag of tags) {
      if (!tagItems.has(tag)) tagItems.set(tag, new Map());
      const items = tagItems.get(tag)!;
      const entry = items.get(row.item) ?? { count: 0, people: new Set() };
      entry.count++;
      entry.people.add(row.person_slug);
      items.set(row.item, entry);
    }
  }

  // Sort tags by total item count
  const sortedTags = [...tagItems.entries()]
    .map(([tag, items]) => {
      const totalPeople = new Set([...items.values()].flatMap((v) => [...v.people])).size;
      return { tag, items, uniqueItems: items.size, totalPeople };
    })
    .sort((a, b) => b.uniqueItems - a.uniqueItems);

  console.log(`${'='.repeat(70)}`);
  console.log(`EXTRACTION REVIEW: ${rows.length} total rows, ${sortedTags.length} tags`);
  console.log(`${'='.repeat(70)}\n`);

  for (const { tag, items, uniqueItems, totalPeople } of sortedTags) {
    const topItems = [...items.entries()]
      .sort((a, b) => b[1].count - a[1].count)
      .slice(0, 15);

    console.log(`\n${tag} (${uniqueItems} unique items, ${totalPeople} people)`);
    console.log(`${'─'.repeat(50)}`);
    for (const [item, { count }] of topItems) {
      console.log(`  ${item.padEnd(40)} ${count}`);
    }
  }

  // Flag potential issues
  console.log(`\n\n${'='.repeat(70)}`);
  console.log('POTENTIAL ISSUES');
  console.log(`${'='.repeat(70)}\n`);

  // Items that appear in many tags
  const itemTags = new Map<string, Set<string>>();
  for (const [tag, items] of tagItems) {
    for (const item of items.keys()) {
      if (!itemTags.has(item)) itemTags.set(item, new Set());
      itemTags.get(item)!.add(tag);
    }
  }

  const multiTagItems = [...itemTags.entries()]
    .filter(([, tags]) => tags.size > 2)
    .sort((a, b) => b[1].size - a[1].size);

  if (multiTagItems.length > 0) {
    console.log('Items in 3+ tags (may indicate vague tagging):');
    for (const [item, tags] of multiTagItems.slice(0, 20)) {
      console.log(`  ${item.padEnd(35)} [${[...tags].join(', ')}]`);
    }
  }

  // Tags with very few items (might be noise)
  const tinyTags = sortedTags.filter((t) => t.uniqueItems <= 2);
  if (tinyTags.length > 0) {
    console.log(`\nTiny tags (<=2 items, might be noise):`);
    for (const { tag, uniqueItems } of tinyTags) {
      const items = [...tagItems.get(tag)!.keys()].join(', ');
      console.log(`  ${tag.padEnd(25)} ${uniqueItems} items: ${items}`);
    }
  }

  // Banned tags that slipped through
  const banned = ['programming', 'web', 'utility', 'apple', 'mac', 'wireless', 'ergonomic', 'mobile', 'client', 'graphics', 'google'];
  const leaks = sortedTags.filter((t) => banned.includes(t.tag));
  if (leaks.length > 0) {
    console.log(`\nBanned tags that leaked through:`);
    for (const { tag, uniqueItems } of leaks) {
      console.log(`  ${tag.padEnd(25)} ${uniqueItems} items`);
    }
  }
}

void main();
