import { readdirSync } from 'node:fs';
import path from 'node:path';
import Database from 'better-sqlite3';
import { drizzle, type BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import * as schema from '../../server/schema';

export type SiteDb = BetterSQLite3Database<typeof schema>;

export function resolveDefaultLocalDbPath(repoRoot: string): string | null {
  const d1Dir = path.join(
    repoRoot,
    '.wrangler',
    'state',
    'v3',
    'd1',
    'miniflare-D1DatabaseObject',
  );

  try {
    const files = readdirSync(d1Dir);
    const sqlite = files.find((entry) => entry.endsWith('.sqlite'));
    if (!sqlite) return null;
    return path.join(d1Dir, sqlite);
  } catch {
    return null;
  }
}

export function createLocalSiteDb(dbPath: string): SiteDb {
  const sqlite = new Database(dbPath);
  sqlite.pragma('journal_mode = WAL');
  sqlite.pragma('foreign_keys = ON');
  return drizzle(sqlite, { schema });
}
