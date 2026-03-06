import { describe, expect, it, vi, beforeEach } from 'vitest';

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
    batch: async (stmts: unknown[]) => stmts,
    dump: async () => new ArrayBuffer(0),
    exec: async () => ({ count: 0, duration: 0 }),
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
      batch: async (stmts: unknown[]) => stmts,
      dump: async () => new ArrayBuffer(0),
      exec: async () => ({ count: 0, duration: 0 }),
    },
    calls,
  };
}

vi.mock('cloudflare:workers', () => ({
  env: {} as Record<string, unknown>,
}));

async function setCfEnv(env: Record<string, unknown>) {
  const mod = await import('cloudflare:workers');
  Object.assign(mod.env, env);
}

async function clearCfEnv() {
  const mod = await import('cloudflare:workers');
  for (const key of Object.keys(mod.env)) {
    delete (mod.env as Record<string, unknown>)[key];
  }
}

describe('d1 helpers', () => {
  beforeEach(async () => {
    await clearCfEnv();
  });

  it('returns null when D1 binding is unavailable', async () => {
    await setCfEnv({});
    const { getScrapedProfileBySlug } = await import('./db/profiles.server');

    const data = await getScrapedProfileBySlug('person-1');
    expect(data).toBeNull();
  });

  it('returns empty arrays when D1 binding is unavailable', async () => {
    await setCfEnv({});
    const { getAllScrapeSummaries } = await import('./db/profiles.server');

    const data = await getAllScrapeSummaries();
    expect(data).toEqual([]);
  });
});
