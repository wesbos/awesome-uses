import { describe, expect, it } from 'vitest';
import {
  getScrapedProfileBySlug,
  resolveD1Database,
  upsertScrapedProfile,
} from './d1';

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

function createFakeDbForUpsert() {
  const calls: unknown[][] = [];
  return {
    db: {
      prepare: () => ({
        bind: (...args: unknown[]) => {
          calls.push(args);
          return {
            first: async () => null,
            all: async () => ({ results: [] }),
          };
        },
      }),
    },
    calls,
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

  it('upserts scraped profile rows into D1', async () => {
    const { db, calls } = createFakeDbForUpsert();

    await upsertScrapedProfile(
      'person-1',
      'https://example.com/uses',
      '2026-01-01T00:00:00.000Z',
      {
        statusCode: 200,
        title: 'Uses',
        contentMarkdown: 'full text',
        contentHash: 'abc123',
      },
      { env: { USES_SCRAPES_DB: db } }
    );

    expect(calls).toHaveLength(3);
    expect(calls[0][0]).toBe('person-1');
    expect(calls[1][0]).toBe('person-1');
    expect(calls[1][1]).toBe('https://example.com/uses');
    expect(calls[1][2]).toBe(200);
    expect(calls[2][0]).toBe('person-1');
    expect(calls[2][5]).toBe('initial');
  });
});
