export type AvatarsR2Bucket = {
  get(key: string): Promise<{ body: ReadableStream; httpMetadata?: { contentType?: string } } | null>;
  head?(key: string): Promise<unknown | null>;
  put(
    key: string,
    value: ArrayBuffer | ReadableStream,
    options?: { httpMetadata?: { contentType?: string } },
  ): Promise<unknown>;
  delete(key: string): Promise<void>;
};

/** Set per-request in `server-entry.ts` from the Worker `env` (includes `AVATARS_BUCKET`). */
const WORKER_ENV_KEY = '__USES_WORKER_ENV';

export function setWorkerEnvForRequest(env: Record<string, unknown>): void {
  (globalThis as Record<string, unknown>)[WORKER_ENV_KEY] = env;
}

export function resolveAvatarsBucket(): AvatarsR2Bucket | null {
  const env = (globalThis as Record<string, unknown>)[WORKER_ENV_KEY] as
    | { AVATARS_BUCKET?: AvatarsR2Bucket }
    | undefined;
  return env?.AVATARS_BUCKET ?? null;
}
