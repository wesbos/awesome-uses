import { env as cfEnv } from 'cloudflare:workers';
import { drizzle, type DrizzleD1Database } from 'drizzle-orm/d1';
import * as schema from '../schema';

type D1Env = { USES_SCRAPES_DB?: Parameters<typeof drizzle>[0] };

export function resolveDb(): DrizzleD1Database<typeof schema> | null {
  const d1 = (cfEnv as D1Env).USES_SCRAPES_DB;
  if (!d1) return null;
  return drizzle(d1, { schema });
}
