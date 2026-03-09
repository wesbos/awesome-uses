import { createRequire } from 'node:module';
import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { PersonRecord } from '../../src/lib/types';
import { buildUniqueSlug } from '../../src/lib/slug';

const require = createRequire(import.meta.url);
const DATA_FILE_PATH = path.resolve(process.cwd(), 'src/data.js');
const GENERATED_PEOPLE_JSON_PATH = path.resolve(
  process.cwd(),
  'src/generated/people.json'
);

export async function loadPeopleFromDataJs(): Promise<PersonRecord[]> {
  const loaded = require(DATA_FILE_PATH) as
    | PersonRecord[]
    | { default?: PersonRecord[] };

  if (Array.isArray(loaded)) {
    return loaded;
  }

  if (loaded && Array.isArray(loaded.default)) {
    return loaded.default;
  }

  throw new Error('Unable to load src/data.js as an array of people.');
}

export function getDataFilePath() {
  return DATA_FILE_PATH;
}

export type PersonRecordWithSlug = PersonRecord & { personSlug: string };

export function addSlugs(people: PersonRecord[]): PersonRecordWithSlug[] {
  const used = new Set<string>();
  return people.map((person) => ({
    ...person,
    personSlug: buildUniqueSlug(person.name, used, 'person'),
  }));
}

export async function writePeopleJsonSnapshot(people: PersonRecord[]): Promise<void> {
  const withSlugs = addSlugs(people);
  await writeFile(
    GENERATED_PEOPLE_JSON_PATH,
    `${JSON.stringify(withSlugs, null, 2)}\n`,
    'utf8'
  );
}

export function getGeneratedPeopleJsonPath() {
  return GENERATED_PEOPLE_JSON_PATH;
}
