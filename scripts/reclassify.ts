import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { writeFile, unlink } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { randomBytes } from 'node:crypto';
import OpenAI from 'openai';
import { z } from 'zod';
import { zodResponseFormat } from 'openai/helpers/zod';
import { sqlValue } from './lib/scrape';

const execFileAsync = promisify(execFile);

async function queryLocalD1<T>(sql: string): Promise<T[]> {
  const { stdout } = await execFileAsync('npx', [
    'wrangler', 'd1', 'execute', 'uses-tech-scrapes',
    '--local', '--json', '--command', sql,
  ], { cwd: process.cwd(), maxBuffer: 50 * 1024 * 1024 });

  const parsed = JSON.parse(stdout);
  return parsed[0]?.results ?? [];
}

async function execD1(dbName: string, sql: string): Promise<void> {
  const tmpFile = join(tmpdir(), `d1-${randomBytes(8).toString('hex')}.sql`);
  await writeFile(tmpFile, sql, 'utf-8');
  try {
    await execFileAsync('npx', [
      'wrangler', 'd1', 'execute', dbName, '--file', tmpFile, '--json',
    ], { cwd: process.cwd() });
  } finally {
    await unlink(tmpFile).catch(() => {});
  }
}

async function loadCategoriesFromD1(): Promise<string[]> {
  const rows = await queryLocalD1<{ category: string }>(`
    SELECT DISTINCT j.value as category
    FROM person_items, json_each(person_items.tags_json) j
    ORDER BY category
  `);
  return rows.map((r) => r.category);
}

const DEFAULT_PROMPT = `You are reviewing items that were categorized as "{category}" during extraction from developer /uses pages.

For each item, decide:
1. Does it belong in an existing category instead? If so, which one(s)?
2. Should a NEW category be created for a group of these items? If so, name it.
3. Should it stay as "{category}"? Only if nothing else fits.

Be specific and consistent. Prefer existing categories. Only propose a new category if 3+ items would belong to it.`;

const ReclassifiedItem = z.object({
  item: z.string().describe('The item name exactly as provided'),
  categories: z.array(z.string()).describe('The corrected category or categories for this item'),
  reasoning: z.string().describe('Brief explanation of why this categorization is correct'),
});

const ReclassifyResult = z.object({
  items: z.array(ReclassifiedItem),
  newCategories: z.array(z.object({
    name: z.string().describe('Proposed new category name (lowercase, hyphenated)'),
    description: z.string().describe('What items belong in this category'),
    examples: z.array(z.string()).describe('Example items from the input that would go here'),
  })).describe('Any new categories you are proposing (only if 3+ items warrant it)'),
});

type ItemRow = {
  item: string;
  count: number;
  people: string;
};

function parseArgs(argv: string[]) {
  const readStringFlag = (flag: string): string | undefined => {
    const idx = argv.indexOf(flag);
    return idx === -1 ? undefined : argv[idx + 1];
  };
  const readFlag = (flag: string, fallback: number) => {
    const idx = argv.indexOf(flag);
    if (idx === -1) return fallback;
    const val = Number(argv[idx + 1]);
    return Number.isFinite(val) && val > 0 ? val : fallback;
  };

  return {
    category: readStringFlag('--category') || 'other',
    minUsers: readFlag('--min', 2),
    limit: readFlag('--limit', Infinity),
    prompt: readStringFlag('--prompt'),
    apply: argv.includes('--apply'),
    model: readStringFlag('--model') || 'gpt-5-mini',
    dbName: readStringFlag('--db') || 'uses-tech-scrapes',
  };
}

async function main() {
  const options = parseArgs(process.argv.slice(2));

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error('OPENAI_API_KEY environment variable is required');
  const client = new OpenAI({ apiKey });

  console.log(`Querying items in "${options.category}" with ${options.minUsers}+ users...\n`);

  const limitClause = Number.isFinite(options.limit) ? `LIMIT ${options.limit}` : '';

  const rows = await queryLocalD1<ItemRow>(`
    SELECT
      item,
      COUNT(DISTINCT person_slug) as count,
      GROUP_CONCAT(DISTINCT person_slug) as people
    FROM person_items
    WHERE tags_json LIKE '%"${options.category}"%'
    GROUP BY item
    HAVING count >= ${options.minUsers}
    ORDER BY count DESC
    ${limitClause}
  `);

  if (rows.length === 0) {
    console.log(`No items found in "${options.category}" with ${options.minUsers}+ users.`);
    return;
  }

  console.log(`Found ${rows.length} items to review.\n`);

  const allCategories = await loadCategoriesFromD1();
  const otherCategories = allCategories.filter((c) => c !== options.category);
  console.log(`Loaded ${allCategories.length} existing categories from D1.\n`);

  const systemPrompt = (options.prompt || DEFAULT_PROMPT).replace(/\{category\}/g, options.category);

  const itemList = rows.map((r) => `- ${r.item}`).join('\n');

  const userMessage = `Existing categories: ${otherCategories.join(', ')}

Items currently in "${options.category}" (${rows.length} items):
${itemList}

For each item, assign the best category or categories. Remember:
- Prefer existing categories from the list above.
- Only propose a new category if 3+ items from this list would belong to it.
- An item can have multiple categories.
- Use "${options.category}" only as a last resort for items that truly don't fit anywhere.`;

  console.log(`Sending ${rows.length} items to ${options.model}...\n`);

  const completion = await client.chat.completions.parse({
    model: options.model,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userMessage },
    ],
    response_format: zodResponseFormat(ReclassifyResult, 'reclassification'),
  });

  const raw = completion.choices[0]?.message;
  if (raw?.refusal) {
    console.log('LLM refused:', raw.refusal);
    return;
  }

  const result = raw?.parsed;
  if (!result) {
    console.log('No parsed result. Raw response:');
    console.log(JSON.stringify(raw, null, 2));
    return;
  }

  console.log(`LLM returned ${result.items.length} items, ${result.newCategories.length} new categories.\n`);

  const moved = result.items.filter(
    (i) => !(i.categories.length === 1 && i.categories[0] === options.category)
  );
  const stayed = result.items.filter(
    (i) => i.categories.length === 1 && i.categories[0] === options.category
  );

  console.log(`${'='.repeat(70)}`);
  console.log(`RECLASSIFICATION RESULTS`);
  console.log(`${'='.repeat(70)}\n`);

  if (result.newCategories.length > 0) {
    console.log('PROPOSED NEW CATEGORIES:');
    for (const cat of result.newCategories) {
      console.log(`  ${cat.name}: ${cat.description}`);
      console.log(`    examples: ${cat.examples.join(', ')}`);
    }
    console.log();
  }

  console.log(`MOVED (${moved.length} items):`);
  for (const item of moved) {
    const row = rows.find((r) => r.item === item.item);
    const users = row ? ` (${row.count} users)` : '';
    console.log(`  ${item.item}${users}`);
    console.log(`    → [${item.categories.join(', ')}]  ${item.reasoning}`);
  }

  console.log(`\nSTAYED IN "${options.category}" (${stayed.length} items):`);
  for (const item of stayed) {
    const row = rows.find((r) => r.item === item.item);
    const users = row ? ` (${row.count} users)` : '';
    console.log(`  ${item.item}${users}: ${item.reasoning}`);
  }

  if (!options.apply) {
    console.log(`\nDry run. To apply changes, re-run with --apply`);
    return;
  }

  console.log(`\nApplying ${moved.length} reclassifications to D1...\n`);

  const rowLookup = new Map(rows.map((r) => [r.item.toLowerCase(), r.item]));

  const movedDbNames = moved
    .map((i) => rowLookup.get(i.item.toLowerCase()))
    .filter((n): n is string => n !== undefined);

  if (movedDbNames.length === 0) {
    console.log('  No matching items found in DB.');
    return;
  }

  const inClause = movedDbNames.map((n) => sqlValue(n)).join(', ');
  const allRows = await queryLocalD1<{ person_slug: string; item: string; tags_json: string }>(`
    SELECT person_slug, item, tags_json FROM person_items
    WHERE item IN (${inClause}) AND tags_json LIKE '%"${options.category}"%'
  `);

  const newCatsByItem = new Map(
    moved.map((i) => [
      (rowLookup.get(i.item.toLowerCase()) ?? i.item).toLowerCase(),
      i.categories,
    ])
  );

  const statements: string[] = [];
  for (const row of allRows) {
    const newCats = newCatsByItem.get(row.item.toLowerCase());
    if (!newCats) continue;

    let current: string[];
    try { current = JSON.parse(row.tags_json); } catch { continue; }

    const withoutOld = current.filter((c) => c !== options.category);
    const merged = [...new Set([...withoutOld, ...newCats])];

    statements.push(
      `UPDATE person_items SET tags_json = ${sqlValue(JSON.stringify(merged))} WHERE person_slug = ${sqlValue(row.person_slug)} AND item = ${sqlValue(row.item)};`
    );
  }

  if (statements.length > 0) {
    await execD1(options.dbName, statements.join('\n'));
  }

  for (const item of moved) {
    const dbName = rowLookup.get(item.item.toLowerCase());
    const count = allRows.filter((r) => r.item.toLowerCase() === item.item.toLowerCase()).length;
    if (dbName && count > 0) {
      console.log(`  ✓ ${item.item}: ${count} rows → [${item.categories.join(', ')}]`);
    } else {
      console.log(`  SKIP "${item.item}" — not found in DB`);
    }
  }

  console.log(`\nDone. Updated ${statements.length} rows across ${moved.length} items.`);
}

void main();
