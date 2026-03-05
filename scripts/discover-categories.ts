import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import pLimit from 'p-limit';
import { createOpenAIClient, DEFAULT_MODEL, extractItemsFromMarkdown, type ExtractedItemType } from './lib/ai';
import { normalizeItems } from './lib/normalize-items';

const execFileAsync = promisify(execFile);

type D1Row = {
  personSlug: string;
  contentMarkdown: string;
};

async function queryLocalD1(sql: string): Promise<D1Row[]> {
  const { stdout } = await execFileAsync('npx', [
    'wrangler', 'd1', 'execute', 'uses-tech-scrapes',
    '--local', '--json', '--command', sql,
  ], { cwd: process.cwd(), maxBuffer: 50 * 1024 * 1024 });

  const parsed = JSON.parse(stdout);
  return parsed[0]?.results ?? [];
}

function parseArgs(argv: string[]) {
  const readFlag = (flag: string, fallback: number) => {
    const idx = argv.indexOf(flag);
    if (idx === -1) return fallback;
    const val = Number(argv[idx + 1]);
    return Number.isFinite(val) && val > 0 ? val : fallback;
  };

  return {
    sample: readFlag('--sample', 50),
    concurrency: readFlag('--concurrency', 10),
    model: argv.includes('--model') ? argv[argv.indexOf('--model') + 1] : DEFAULT_MODEL,
  };
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const client = createOpenAIClient();
  const limit = pLimit(options.concurrency);

  console.log(`Sampling ${options.sample} pages for category discovery (model: ${options.model}, concurrency: ${options.concurrency})...`);

  const rows = await queryLocalD1(
    `SELECT person_slug as personSlug, content_markdown as contentMarkdown
     FROM person_pages
     WHERE content_markdown IS NOT NULL AND content_markdown != ''
     ORDER BY RANDOM()
     LIMIT ${options.sample}`
  );

  console.log(`Got ${rows.length} pages from local D1.\n`);

  const allItems: ExtractedItemType[] = [];

  const tasks = rows.map((row, idx) =>
    limit(async () => {
      try {
        const result = await extractItemsFromMarkdown(client, row.contentMarkdown, options.model);
        const normalized = normalizeItems(result.items);
        allItems.push(...normalized);
        console.log(
          `${String(idx + 1).padStart(4)} [${normalized.length} items] ${row.personSlug}`
        );
      } catch (err) {
        console.log(
          `${String(idx + 1).padStart(4)} [ERROR] ${row.personSlug}: ${err instanceof Error ? err.message : err}`
        );
      }
    })
  );

  await Promise.all(tasks);

  const categoryCounts = new Map<string, number>();
  const itemCounts = new Map<string, number>();

  for (const item of allItems) {
    const normalizedItem = item.item.toLowerCase().trim();
    itemCounts.set(normalizedItem, (itemCounts.get(normalizedItem) || 0) + 1);

    for (const cat of item.categories) {
      const c = cat.toLowerCase().trim();
      categoryCounts.set(c, (categoryCounts.get(c) || 0) + 1);
    }
  }

  const sortedCategories = [...categoryCounts.entries()].sort((a, b) => b[1] - a[1]);
  const sortedItems = [...itemCounts.entries()].sort((a, b) => b[1] - a[1]);

  console.log(`\n${'='.repeat(60)}`);
  console.log(`DISCOVERY RESULTS (${allItems.length} items from ${rows.length} pages)`);
  console.log(`${'='.repeat(60)}\n`);

  console.log('TOP 50 CATEGORIES:');
  for (const [cat, count] of sortedCategories.slice(0, 50)) {
    console.log(`  ${cat.padEnd(25)} ${count}`);
  }

  console.log(`\nTOP 50 ITEMS:`);
  for (const [item, count] of sortedItems.slice(0, 50)) {
    console.log(`  ${item.padEnd(40)} ${count}`);
  }

  const output = {
    meta: {
      sampledPages: rows.length,
      totalItems: allItems.length,
      model: options.model,
      generatedAt: new Date().toISOString(),
    },
    topCategories: Object.fromEntries(sortedCategories.slice(0, 100)),
    topItems: Object.fromEntries(sortedItems.slice(0, 100)),
    allExtractedItems: allItems,
  };

  const outPath = path.resolve(process.cwd(), 'src/generated/discovery-results.json');
  await writeFile(outPath, JSON.stringify(output, null, 2) + '\n', 'utf8');
  console.log(`\nFull results written to ${outPath}`);
}

void main();
