import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { writeFile, unlink } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { randomBytes } from 'node:crypto';
import pLimit from 'p-limit';
import { createOpenAIClient, DEFAULT_MODEL, extractItemsFromMarkdown } from './lib/ai';
import { normalizeItems } from './lib/normalize-items';
import { sqlValue } from './lib/scrape';

const execFileAsync = promisify(execFile);

type D1Row = {
  personSlug: string;
  contentMarkdown: string;
};

function parseArgs(argv: string[]) {
  const readFlag = (flag: string, fallback: number) => {
    const idx = argv.indexOf(flag);
    if (idx === -1) return fallback;
    const val = Number(argv[idx + 1]);
    return Number.isFinite(val) && val > 0 ? val : fallback;
  };
  const readStringFlag = (flag: string): string | undefined => {
    const idx = argv.indexOf(flag);
    return idx === -1 ? undefined : argv[idx + 1];
  };

  return {
    concurrency: readFlag('--concurrency', 10),
    limit: readFlag('--limit', Infinity),
    model: readStringFlag('--model') || DEFAULT_MODEL,
    remote: argv.includes('--remote'),
    dbName: readStringFlag('--db') || 'uses-tech-scrapes',
    skipExisting: !argv.includes('--force'),
    person: readStringFlag('--person'),
  };
}

async function queryLocalD1(sql: string): Promise<D1Row[]> {
  const { stdout } = await execFileAsync('npx', [
    'wrangler', 'd1', 'execute', 'uses-tech-scrapes',
    '--local', '--json', '--command', sql,
  ], { cwd: process.cwd(), maxBuffer: 50 * 1024 * 1024 });

  const parsed = JSON.parse(stdout);
  return parsed[0]?.results ?? [];
}

async function execD1(dbName: string, sql: string, remote: boolean): Promise<void> {
  const tmpFile = join(tmpdir(), `d1-${randomBytes(8).toString('hex')}.sql`);
  await writeFile(tmpFile, sql, 'utf-8');
  try {
    const args = ['wrangler', 'd1', 'execute', dbName, '--file', tmpFile, '--json'];
    if (remote) args.push('--remote');
    await execFileAsync('npx', args, { cwd: process.cwd() });
  } finally {
    await unlink(tmpFile).catch(() => {});
  }
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const client = createOpenAIClient();
  const extractedAt = new Date().toISOString();
  const limit = pLimit(options.concurrency);

  let whereClause = "WHERE content_markdown IS NOT NULL AND content_markdown != ''";
  if (options.person) {
    whereClause += ` AND person_slug LIKE '%${options.person.replace(/'/g, "''")}%'`;
  }
  if (options.skipExisting) {
    whereClause += ` AND person_slug NOT IN (SELECT DISTINCT person_slug FROM person_items)`;
  }

  const limitClause = Number.isFinite(options.limit) ? `LIMIT ${options.limit}` : '';

  const rows = await queryLocalD1(
    `SELECT person_slug as personSlug, content_markdown as contentMarkdown
     FROM person_pages
     ${whereClause}
     ORDER BY person_slug
     ${limitClause}`
  );

  if (rows.length === 0) {
    console.log('No pages to process.');
    return;
  }

  console.log(`Extracting items from ${rows.length} pages (model: ${options.model}, concurrency: ${options.concurrency})...\n`);

  let totalItems = 0;
  let processed = 0;
  let errors = 0;

  const tasks = rows.map((row, idx) =>
    limit(async () => {
      try {
        const result = await extractItemsFromMarkdown(client, row.contentMarkdown, options.model);
        const normalized = normalizeItems(result.items);

        if (normalized.length > 0) {
          const statements = normalized.map((item) =>
            `INSERT INTO person_items (person_slug, item, tags_json, detail, extracted_at)
             VALUES (${sqlValue(row.personSlug)}, ${sqlValue(item.item)}, ${sqlValue(JSON.stringify(item.categories))}, ${sqlValue(item.detail)}, ${sqlValue(extractedAt)})
             ON CONFLICT(person_slug, item) DO UPDATE SET
               tags_json=excluded.tags_json,
               detail=excluded.detail,
               extracted_at=excluded.extracted_at;`
          );

          await execD1(options.dbName, statements.join('\n'), options.remote);
          totalItems += normalized.length;
        }

        processed++;
        console.log(
          `${String(idx + 1).padStart(4)} [${normalized.length} items] ${row.personSlug}`
        );
      } catch (err) {
        errors++;
        console.log(
          `${String(idx + 1).padStart(4)} [ERROR] ${row.personSlug}: ${err instanceof Error ? err.message : err}`
        );
      }
    })
  );

  await Promise.all(tasks);

  console.log(`\nDone. Processed: ${processed}, Items extracted: ${totalItems}, Errors: ${errors}`);
}

void main();
