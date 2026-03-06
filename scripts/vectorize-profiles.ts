/**
 * @deprecated Use the dashboard UI at /dashboard instead.
 * The "Batch Vectorize" card provides the same functionality via
 * $batchVectorize, using the app's vectorizeProfile helper.
 *
 * Original description:
 * Vectorize all scraped /uses profiles into Cloudflare Vectorize.
 * Reads content_markdown from D1, generates embeddings via OpenAI
 * text-embedding-3-small, and upserts vectors with personSlug as the ID.
 */

import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { setTimeout as delay } from 'node:timers/promises';

const execFileAsync = promisify(execFile);

type ScrapedRow = {
  person_slug: string;
  content_markdown: string;
};

type ParsedArgs = {
  remote: boolean;
  dbName: string;
  indexName: string;
  limit?: number;
  batchSize: number;
};

function parseArgs(argv: string[]): ParsedArgs {
  const readStringFlag = (flag: string): string | undefined => {
    const idx = argv.indexOf(flag);
    return idx === -1 ? undefined : argv[idx + 1];
  };
  const readNumericFlag = (flag: string, fallback: number): number => {
    const val = readStringFlag(flag);
    const n = val ? Number(val) : NaN;
    return Number.isFinite(n) && n > 0 ? n : fallback;
  };

  const limitStr = readStringFlag('--limit');
  return {
    remote: argv.includes('--remote'),
    dbName: readStringFlag('--db') || 'uses-tech-scrapes',
    indexName: readStringFlag('--index') || 'uses-similarity',
    limit: limitStr && Number(limitStr) > 0 ? Number(limitStr) : undefined,
    batchSize: readNumericFlag('--batch', 100),
  };
}

async function queryD1<T>(dbName: string, sql: string, remote: boolean): Promise<T[]> {
  const args = ['wrangler', 'd1', 'execute', dbName, '--json', '--command', sql];
  if (remote) args.push('--remote');
  else args.push('--local');

  const { stdout } = await execFileAsync('npx', args, {
    cwd: process.cwd(),
    maxBuffer: 100 * 1024 * 1024,
  });

  const parsed = JSON.parse(stdout);
  return parsed[0]?.results ?? [];
}

async function getEmbeddings(
  texts: string[],
  apiKey: string,
): Promise<number[][]> {
  const truncated = texts.map((t) => t.slice(0, 8000));

  const response = await fetch('https://api.openai.com/v1/embeddings', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'text-embedding-3-small',
      input: truncated,
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`OpenAI embeddings API error ${response.status}: ${body}`);
  }

  const data = (await response.json()) as {
    data: Array<{ embedding: number[]; index: number }>;
  };

  return data.data
    .sort((a, b) => a.index - b.index)
    .map((d) => d.embedding);
}

async function upsertVectors(
  indexName: string,
  vectors: Array<{ id: string; values: number[] }>,
  remote: boolean,
): Promise<void> {
  const ndjson = vectors
    .map((v) => JSON.stringify({ id: v.id, values: v.values }))
    .join('\n');

  const tmpFile = `/tmp/vectorize-${Date.now()}.ndjson`;
  const { writeFile, unlink } = await import('node:fs/promises');
  await writeFile(tmpFile, ndjson, 'utf-8');

  try {
    const args = ['wrangler', 'vectorize', 'insert', indexName, '--file', tmpFile];
    if (remote) args.push('--remote');
    await execFileAsync('npx', args, { cwd: process.cwd() });
  } finally {
    await unlink(tmpFile).catch(() => {});
  }
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));

  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) {
    console.error('OPENAI_API_KEY environment variable is required.');
    process.exit(1);
  }

  console.log(`Fetching scraped profiles from D1 (${opts.remote ? 'remote' : 'local'})...`);

  let sql = `SELECT person_slug, content_markdown FROM person_pages WHERE content_markdown IS NOT NULL AND length(content_markdown) > 100`;
  if (opts.limit) sql += ` LIMIT ${opts.limit}`;

  const rows = await queryD1<ScrapedRow>(opts.dbName, sql, opts.remote);
  console.log(`Found ${rows.length} profiles with content.`);

  if (rows.length === 0) return;

  let processed = 0;
  for (let i = 0; i < rows.length; i += opts.batchSize) {
    const batch = rows.slice(i, i + opts.batchSize);
    const texts = batch.map((r) => r.content_markdown);

    console.log(`Generating embeddings for batch ${Math.floor(i / opts.batchSize) + 1} (${batch.length} profiles)...`);
    const embeddings = await getEmbeddings(texts, apiKey);

    const vectors = batch.map((row, idx) => ({
      id: row.person_slug,
      values: embeddings[idx],
    }));

    console.log(`Upserting ${vectors.length} vectors to ${opts.indexName}...`);
    await upsertVectors(opts.indexName, vectors, opts.remote);

    processed += batch.length;
    console.log(`Progress: ${processed}/${rows.length}`);

    if (i + opts.batchSize < rows.length) {
      await delay(500);
    }
  }

  console.log(`Done. Vectorized ${processed} profiles.`);
}

void main();
