import path from 'node:path';
import { readFileSync } from 'node:fs';
import { createLocalSiteDb, resolveDefaultLocalDbPath, type SiteDb } from './stores/site-db';
import { ConfigurationError } from './errors';

type PackageJson = {
  name?: string;
};

export type SiteManagementContextOptions = {
  repoRoot?: string;
  dbPath?: string;
  db?: SiteDb;
};

export type SiteManagementContext = {
  repoRoot: string;
  dbPath: string | null;
  db: SiteDb;
};

function inferRepoRoot(): string {
  const cwd = process.cwd();
  const pkgPath = path.join(cwd, 'package.json');
  try {
    const raw = readFileSync(pkgPath, 'utf-8');
    const pkg = JSON.parse(raw) as PackageJson;
    if (pkg?.name) return cwd;
  } catch {
    console.log('[site-management] Could not read package.json at', pkgPath);
  }
  return cwd;
}

export function createSiteManagementContext(
  options: SiteManagementContextOptions = {},
): SiteManagementContext {
  if (options.db) {
    return {
      repoRoot: options.repoRoot ?? process.env.SITE_REPO_ROOT ?? process.cwd(),
      dbPath: options.dbPath ?? null,
      db: options.db,
    };
  }

  const repoRoot = options.repoRoot ?? process.env.SITE_REPO_ROOT ?? inferRepoRoot();

  const dbPath =
    options.dbPath ??
    process.env.SITE_DB_PATH ??
    resolveDefaultLocalDbPath(repoRoot);

  if (!dbPath) {
    throw new ConfigurationError(
      'Database path is not configured. Set SITE_DB_PATH or initialize local D1 state.',
    );
  }

  const db = createLocalSiteDb(dbPath);

  return {
    repoRoot,
    dbPath,
    db,
  };
}
