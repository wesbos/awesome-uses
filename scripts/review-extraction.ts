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

  // Group by category
  const categoryItems = new Map<string, Map<string, { count: number; people: Set<string> }>>();

  for (const row of rows) {
    let categories: string[];
    try {
      categories = JSON.parse(row.tags_json);
    } catch {
      categories = ['unknown'];
    }

    for (const cat of categories) {
      if (!categoryItems.has(cat)) categoryItems.set(cat, new Map());
      const items = categoryItems.get(cat)!;
      const entry = items.get(row.item) ?? { count: 0, people: new Set() };
      entry.count++;
      entry.people.add(row.person_slug);
      items.set(row.item, entry);
    }
  }

  // Sort categories by total item count
  const sortedCategories = [...categoryItems.entries()]
    .map(([cat, items]) => {
      const totalPeople = new Set([...items.values()].flatMap((v) => [...v.people])).size;
      return { cat, items, uniqueItems: items.size, totalPeople };
    })
    .sort((a, b) => b.uniqueItems - a.uniqueItems);

  console.log(`${'='.repeat(70)}`);
  console.log(`EXTRACTION REVIEW: ${rows.length} total rows, ${sortedCategories.length} categories`);
  console.log(`${'='.repeat(70)}\n`);

  for (const { cat, items, uniqueItems, totalPeople } of sortedCategories) {
    const topItems = [...items.entries()]
      .sort((a, b) => b[1].count - a[1].count)
      .slice(0, 15);

    console.log(`\n${cat} (${uniqueItems} unique items, ${totalPeople} people)`);
    console.log(`${'─'.repeat(50)}`);
    for (const [item, { count }] of topItems) {
      console.log(`  ${item.padEnd(40)} ${count}`);
    }
  }

  // Flag potential issues
  console.log(`\n\n${'='.repeat(70)}`);
  console.log('POTENTIAL ISSUES');
  console.log(`${'='.repeat(70)}\n`);

  // Items that appear in many categories
  const itemCategories = new Map<string, Set<string>>();
  for (const [cat, items] of categoryItems) {
    for (const item of items.keys()) {
      if (!itemCategories.has(item)) itemCategories.set(item, new Set());
      itemCategories.get(item)!.add(cat);
    }
  }

  const multiCatItems = [...itemCategories.entries()]
    .filter(([, cats]) => cats.size > 2)
    .sort((a, b) => b[1].size - a[1].size);

  if (multiCatItems.length > 0) {
    console.log('Items in 3+ categories (may indicate vague categorization):');
    for (const [item, cats] of multiCatItems.slice(0, 20)) {
      console.log(`  ${item.padEnd(35)} [${[...cats].join(', ')}]`);
    }
  }

  // Categories with very few items (might be noise)
  const tinyCats = sortedCategories.filter((c) => c.uniqueItems <= 2);
  if (tinyCats.length > 0) {
    console.log(`\nTiny categories (<=2 items, might be noise):`);
    for (const { cat, uniqueItems } of tinyCats) {
      const items = [...categoryItems.get(cat)!.keys()].join(', ');
      console.log(`  ${cat.padEnd(25)} ${uniqueItems} items: ${items}`);
    }
  }

  // Banned categories that slipped through
  const banned = ['programming', 'web', 'utility', 'apple', 'mac', 'wireless', 'ergonomic', 'mobile', 'client', 'graphics', 'google'];
  const leaks = sortedCategories.filter((c) => banned.includes(c.cat));
  if (leaks.length > 0) {
    console.log(`\nBanned categories that leaked through:`);
    for (const { cat, uniqueItems } of leaks) {
      console.log(`  ${cat.padEnd(25)} ${uniqueItems} items`);
    }
  }
}

void main();
