import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { writeFile, unlink } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { randomBytes } from 'node:crypto';
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

async function execD1(sql: string): Promise<void> {
  const tmpFile = join(tmpdir(), `d1-${randomBytes(8).toString('hex')}.sql`);
  await writeFile(tmpFile, sql, 'utf-8');
  try {
    await execFileAsync('npx', [
      'wrangler', 'd1', 'execute', 'uses-tech-scrapes', '--file', tmpFile, '--json',
    ], { cwd: process.cwd() });
  } finally {
    await unlink(tmpFile).catch(() => {});
  }
}

type ItemRow = { item: string; count: number };

function parseArgs(argv: string[]) {
  return {
    apply: argv.includes('--apply'),
  };
}

async function main() {
  const { apply } = parseArgs(process.argv.slice(2));

  console.log('Scanning for case-duplicate items...\n');

  const rows = await queryLocalD1<ItemRow>(`
    SELECT item, COUNT(*) as count
    FROM person_items
    GROUP BY item
    ORDER BY count DESC
  `);

  // Group items by their lowercased form
  const groups = new Map<string, ItemRow[]>();
  for (const row of rows) {
    const key = row.item.toLowerCase();
    const group = groups.get(key);
    if (group) {
      group.push(row);
    } else {
      groups.set(key, [row]);
    }
  }

  // Filter to only groups with 2+ variants
  const dupes = [...groups.entries()]
    .filter(([, variants]) => variants.length >= 2)
    .sort((a, b) => {
      const aTotal = a[1].reduce((s, v) => s + v.count, 0);
      const bTotal = b[1].reduce((s, v) => s + v.count, 0);
      return bTotal - aTotal;
    });

  if (dupes.length === 0) {
    console.log('No case-duplicates found.');
    return;
  }

  console.log(`Found ${dupes.length} groups of case-duplicates:\n`);

  const statements: string[] = [];

  for (const [, variants] of dupes) {
    // Pick the variant with the most rows as canonical
    const sorted = [...variants].sort((a, b) => b.count - a.count);
    const canonical = sorted[0];
    const others = sorted.slice(1);

    const otherNames = others.map((o) => `"${o.item}" (${o.count})`).join(', ');
    console.log(`  ✓ ${canonical.item} (${canonical.count})  ←  ${otherNames}`);

    for (const other of others) {
      statements.push(
        `UPDATE person_items SET item = ${sqlValue(canonical.item)} WHERE item = ${sqlValue(other.item)};`
      );
    }
  }

  console.log(`\nTotal: ${statements.length} UPDATE statements across ${dupes.length} groups.`);

  if (!apply) {
    console.log('\nDry run. To apply changes, re-run with --apply');
    return;
  }

  console.log('\nApplying...');
  await execD1(statements.join('\n'));
  console.log('Done.');
}

void main();
