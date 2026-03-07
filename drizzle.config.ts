import { defineConfig } from 'drizzle-kit';
import { readdirSync } from 'node:fs';
import { join } from 'node:path';

function findLocalD1Database(): string {
  const d1Dir = join('.wrangler', 'state', 'v3', 'd1', 'miniflare-D1DatabaseObject');
  try {
    const files = readdirSync(d1Dir);
    const sqlite = files.find((f) => f.endsWith('.sqlite'));
    if (sqlite) return join(d1Dir, sqlite);
  } catch {
    // .wrangler dir doesn't exist yet
  }
  throw new Error(
    'No local D1 database found. Run the dev server once first so wrangler creates the local DB.',
  );
}

export default defineConfig({
  schema: './src/server/schema.ts',
  out: './db/migrations',
  dialect: 'sqlite',
  dbCredentials: {
    url: findLocalD1Database(),
  },
});
