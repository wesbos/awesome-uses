import { readdirSync } from 'node:fs';
import path from 'node:path';
import Database from 'better-sqlite3';
import { ConfigurationError } from '../errors';

export type SiteDbStoreOptions = {
  dbPath: string | null;
};

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

export class SiteDbStore {
  private readonly dbPath: string | null;
  private db: Database.Database | null = null;

  constructor(options: SiteDbStoreOptions) {
    this.dbPath = options.dbPath;
  }

  get configuredPath(): string | null {
    return this.dbPath;
  }

  private ensureDb(): Database.Database {
    if (!this.dbPath) {
      throw new ConfigurationError(
        'Database path is not configured. Set SITE_DB_PATH or initialize local D1 state.',
      );
    }

    if (!this.db) {
      this.db = new Database(this.dbPath);
      this.db.pragma('journal_mode = WAL');
      this.db.pragma('foreign_keys = ON');
    }
    return this.db;
  }

  all<T = Record<string, unknown>>(sql: string, params: unknown[] = []): T[] {
    const db = this.ensureDb();
    const stmt = db.prepare(sql);
    return stmt.all(...params) as T[];
  }

  get<T = Record<string, unknown>>(sql: string, params: unknown[] = []): T | undefined {
    const db = this.ensureDb();
    const stmt = db.prepare(sql);
    return stmt.get(...params) as T | undefined;
  }

  run(sql: string, params: unknown[] = []): Database.RunResult {
    const db = this.ensureDb();
    const stmt = db.prepare(sql);
    return stmt.run(...params);
  }

  transaction<T>(handler: (db: Database.Database) => T): T {
    const db = this.ensureDb();
    const txn = db.transaction(() => handler(db));
    return txn();
  }

  close(): void {
    if (this.db) {
      this.db.close();
      this.db = null;
    }
  }
}
