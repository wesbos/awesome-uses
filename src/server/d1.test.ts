import { describe, expect, it, vi, beforeEach } from 'vite-plus/test';
import { env } from 'cloudflare:workers';
import { getAllScrapeSummaries, getScrapedProfileBySlug } from './db/profiles.server';

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
  Object.assign(envModule, env);
}

async function clearCfEnv() {
  for (const key of Object.keys(envModule)) {
    delete (envModule as Record<string, unknown>)[key];
  }
}

const envModule = env as Record<string, unknown>;

describe('d1 helpers', () => {
  beforeEach(async () => {
    await clearCfEnv();
  });

  it('returns null when D1 binding is unavailable', async () => {
    await setCfEnv({});

    const data = await getScrapedProfileBySlug('person-1');
    expect(data).toBeNull();
  });

  it('returns empty arrays when D1 binding is unavailable', async () => {
    await setCfEnv({});

    const data = await getAllScrapeSummaries();
    expect(data).toEqual([]);
  });
});
