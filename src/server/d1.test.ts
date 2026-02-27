import { describe, expect, it } from 'vitest';
import { getScrapedProfileBySlug, resolveD1Database } from './d1';

type FakeRow = {
  personSlug: string;
  title: string;
};

function createFakeDb(row: FakeRow | null) {
  return {
    prepare: () => ({
      bind: () => ({
        first: async () => row,
        all: async () => ({ results: row ? [row] : [] }),
      }),
    }),
  };
}

describe('d1 helpers', () => {
  it('resolves D1 binding from request context env', () => {
    const db = createFakeDb(null);
    const resolved = resolveD1Database({ env: { USES_SCRAPES_DB: db } });
    expect(resolved).toBe(db);
  });

  it('returns scraped profile row from provided context binding', async () => {
    const row = {
      personSlug: 'person-1',
      title: 'Uses page',
    } as unknown as Awaited<ReturnType<typeof getScrapedProfileBySlug>>;

    const data = await getScrapedProfileBySlug('person-1', {
      env: { USES_SCRAPES_DB: createFakeDb(row as unknown as FakeRow) },
    });
    expect(data).toEqual(row);
  });

  it('returns null when D1 binding is unavailable', async () => {
    const data = await getScrapedProfileBySlug('person-1', {});
    expect(data).toBeNull();
  });
});
