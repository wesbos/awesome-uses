import { createRequire } from 'node:module';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import util from 'node:util';
import type { PersonRecord } from '../../src/lib/types';

const require = createRequire(import.meta.url);
const DATA_FILE_PATH = path.resolve(process.cwd(), 'src/data.js');

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

export async function writePeopleToDataJs(people: PersonRecord[]): Promise<void> {
  const existing = await readFile(DATA_FILE_PATH, 'utf8');
  const [header] = existing.split('module.exports =');
  const preservedHeader = header.trimEnd();

  const serializedPeople = util.inspect(people, {
    depth: null,
    maxArrayLength: null,
    compact: false,
    sorted: false,
    breakLength: 80,
  });

  const nextDataFile = `${preservedHeader}\nmodule.exports = ${serializedPeople};\n`;
  await writeFile(DATA_FILE_PATH, nextDataFile, 'utf8');
}

export function getDataFilePath() {
  return DATA_FILE_PATH;
}
