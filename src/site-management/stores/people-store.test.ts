import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';
import { createSiteManagementFixture } from '../test-utils';

describe('PeopleStore', () => {
  it('loads people, writes updates, and syncs snapshot', async () => {
    const fixture = await createSiteManagementFixture();
    const { peopleStore } = fixture.context;

    const people = await peopleStore.loadPeople();
    expect(people).toHaveLength(2);

    await peopleStore.writePeople([
      ...people,
      {
        name: 'Linus Torvalds',
        description: 'Builder',
        url: 'https://linus.dev/uses',
        country: '🇫🇮',
        tags: ['Git'],
      },
    ]);

    const updated = await peopleStore.loadPeople();
    expect(updated).toHaveLength(3);

    const generatedRaw = await readFile(fixture.generatedPeoplePath, 'utf8');
    const generated = JSON.parse(generatedRaw) as Array<{ name: string }>;
    expect(generated.map((entry) => entry.name)).toContain('Linus Torvalds');

    await fixture.cleanup();
  });
});
