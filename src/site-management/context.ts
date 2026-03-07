import path from 'node:path';
import { createRequire } from 'node:module';
import { PeopleStore } from './stores/people-store';
import { SiteDbStore, resolveDefaultLocalDbPath } from './stores/site-db';

const require = createRequire(import.meta.url);

type PackageJson = {
  name?: string;
};

export type SiteManagementContextOptions = {
  repoRoot?: string;
  dataFilePath?: string;
  generatedPeoplePath?: string;
  dbPath?: string;
};

export type SiteManagementContext = {
  repoRoot: string;
  dataFilePath: string;
  generatedPeoplePath: string;
  dbPath: string | null;
  peopleStore: PeopleStore;
  siteDb: SiteDbStore;
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
  const dbPath =
    options.dbPath ??
    process.env.SITE_DB_PATH ??
    resolveDefaultLocalDbPath(repoRoot);

  const peopleStore = new PeopleStore({
    dataFilePath,
    generatedPeoplePath,
  });
  const siteDb = new SiteDbStore({ dbPath: dbPath || null });

  return {
    repoRoot,
    dataFilePath,
    generatedPeoplePath,
    dbPath: dbPath || null,
    peopleStore,
    siteDb,
  };
}
