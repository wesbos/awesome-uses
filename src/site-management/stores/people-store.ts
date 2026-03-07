import { createRequire } from 'node:module';
import { readFile, writeFile } from 'node:fs/promises';
import util from 'node:util';
import { buildUniqueSlug } from '../../lib/slug';
import type { PersonRecord } from '../../lib/types';
import { ConfigurationError } from '../errors';

const require = createRequire(import.meta.url);

export type PeopleStoreOptions = {
  dataFilePath: string;
  generatedPeoplePath: string;
};

export type PersonWithSlug = PersonRecord & {
  personSlug: string;
};

function clearRequireCache(modulePath: string) {
  const resolved = require.resolve(modulePath);
  delete require.cache[resolved];
}

export class PeopleStore {
  private readonly dataFilePath: string;
  private readonly generatedPeoplePath: string;

  constructor(options: PeopleStoreOptions) {
    this.dataFilePath = options.dataFilePath;
    this.generatedPeoplePath = options.generatedPeoplePath;
  }

  async loadPeople(): Promise<PersonRecord[]> {
    try {
      clearRequireCache(this.dataFilePath);
      const loaded = require(this.dataFilePath) as
        | PersonRecord[]
        | {
            default?: PersonRecord[];
          };

      if (Array.isArray(loaded)) return loaded;
      if (Array.isArray(loaded?.default)) return loaded.default;
      throw new ConfigurationError('src/data.js did not export a people array.');
    } catch (error) {
      if (error instanceof ConfigurationError) throw error;
      throw new ConfigurationError('Failed to load src/data.js.', error);
    }
  }

  withPersonSlugs(people: PersonRecord[]): PersonWithSlug[] {
    const used = new Set<string>();
    return people.map((person) => ({
      ...person,
      personSlug: buildUniqueSlug(person.name, used, 'person'),
    }));
  }

  async listPeopleWithSlugs(): Promise<PersonWithSlug[]> {
    const people = await this.loadPeople();
    return this.withPersonSlugs(people);
  }

  async writePeople(people: PersonRecord[]): Promise<void> {
    const existing = await readFile(this.dataFilePath, 'utf8');
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
    await writeFile(this.dataFilePath, nextDataFile, 'utf8');
    await this.writeSnapshot(people);
  }

  async writeSnapshot(people: PersonRecord[]): Promise<void> {
    await writeFile(this.generatedPeoplePath, `${JSON.stringify(people, null, 2)}\n`, 'utf8');
  }

  async syncSnapshotFromDataFile(): Promise<{ peopleCount: number }> {
    const people = await this.loadPeople();
    await this.writeSnapshot(people);
    return { peopleCount: people.length };
  }
}
