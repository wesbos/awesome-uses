import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import Database from 'better-sqlite3';
import { createSiteManagementContext } from './context';

export async function createSiteManagementFixture() {
  const root = await mkdtemp(path.join(os.tmpdir(), 'site-management-'));

  const dbPath = path.join(root, 'site.db');
  const rawDb = new Database(dbPath);
  rawDb.exec(`
    CREATE TABLE IF NOT EXISTS person_pages (
      person_slug TEXT PRIMARY KEY,
      url TEXT NOT NULL,
      status_code INTEGER,
      fetched_at TEXT NOT NULL,
      title TEXT,
      content_markdown TEXT,
      content_hash TEXT,
      vectorized_at TEXT
    );
    CREATE TABLE IF NOT EXISTS person_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      person_slug TEXT NOT NULL,
      item TEXT NOT NULL,
      tags_json TEXT NOT NULL DEFAULT '[]',
      detail TEXT,
      extracted_at TEXT NOT NULL,
      UNIQUE(person_slug, item)
    );
    CREATE TABLE IF NOT EXISTS person_page_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      person_slug TEXT NOT NULL,
      url TEXT NOT NULL,
      status_code INTEGER,
      fetched_at TEXT NOT NULL,
      content_hash TEXT,
      change_type TEXT NOT NULL,
      title TEXT
    );
    CREATE TABLE IF NOT EXISTS items (
      item_slug TEXT PRIMARY KEY,
      item_name TEXT NOT NULL,
      item_type TEXT,
      description TEXT,
      item_url TEXT,
      enriched_at TEXT
    );
    CREATE TABLE IF NOT EXISTS site_management_vectors (
      person_slug TEXT PRIMARY KEY,
      embedding_json TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
  `);
  rawDb.close();

  const context = createSiteManagementContext({
    repoRoot: root,
    dbPath,
  });

  async function cleanup() {
    await rm(root, { recursive: true, force: true });
  }

  return {
    root,
    dbPath,
    context,
    cleanup,
  };
}
