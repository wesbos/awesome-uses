import path from 'node:path';
import { createRequire } from 'node:module';
import { PeopleStore } from './stores/people-store';
import { createLocalSiteDb, resolveDefaultLocalDbPath, type SiteDb } from './stores/site-db';
import { ConfigurationError } from './errors';

const require = createRequire(import.meta.url);

type PackageJson = {
  name?: string;
};

export type SiteManagementContextOptions = {
  repoRoot?: string;
  dataFilePath?: string;
  generatedPeoplePath?: string;
  dbPath?: string;
  db?: SiteDb;
};

export type SiteManagementContext = {
  repoRoot: string;
  dataFilePath: string;
  generatedPeoplePath: string;
  dbPath: string | null;
  peopleStore: PeopleStore;
  db: SiteDb;
};

function inferRepoRoot(): string {
  const cwd = process.cwd();
  const pkgPath = path.join(cwd, 'package.json');
  try {
    const pkg = require(pkgPath) as PackageJson;
    if (pkg?.name) return cwd;
  } catch {
    // ignore
  }
  return cwd;
}

export function createSiteManagementContext(
  options: SiteManagementContextOptions = {},
): SiteManagementContext {
  const repoRoot = options.repoRoot ?? process.env.SITE_REPO_ROOT ?? inferRepoRoot();
  const dataFilePath =
    options.dataFilePath ?? process.env.SITE_DATA_FILE_PATH ?? path.join(repoRoot, 'src', 'data.js');
  const generatedPeoplePath =
    options.generatedPeoplePath ??
    process.env.SITE_GENERATED_PEOPLE_PATH ??
    path.join(repoRoot, 'src', 'generated', 'people.json');

  const peopleStore = new PeopleStore({
    dataFilePath,
    generatedPeoplePath,
  });

  if (options.db) {
    return {
      repoRoot,
      dataFilePath,
      generatedPeoplePath,
      dbPath: options.dbPath ?? null,
      peopleStore,
      db: options.db,
    };
  }

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
    dataFilePath,
    generatedPeoplePath,
    dbPath,
    peopleStore,
    db,
  };
}
