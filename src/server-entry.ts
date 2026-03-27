import handler from '@tanstack/react-start/server-entry';
import { setWorkerEnvForRequest } from './server/avatars-bucket.server';

export { AwardsWorkflow } from './server/awards/workflow';

type WorkflowBinding = {
  create(options?: { id?: string; params?: unknown }): Promise<{ id: string }>;
};

type R2Bucket = {
  get(key: string): Promise<{ body: ReadableStream; httpMetadata?: { contentType?: string } } | null>;
  head?(key: string): Promise<unknown | null>;
  put(key: string, value: ArrayBuffer | ReadableStream, options?: { httpMetadata?: { contentType?: string } }): Promise<unknown>;
};

type Env = {
  AWARDS_WORKFLOW: WorkflowBinding;
  AVATARS_BUCKET: R2Bucket;
};

type CfFetchCtx = { waitUntil(promise: Promise<unknown>): void; passThroughOnException(): void };

export default {
  fetch(request: Request, env: Env, ctx: CfFetchCtx) {
    setWorkerEnvForRequest(env as unknown as Record<string, unknown>);
    const run = handler.fetch as (
      req: Request,
      workerEnv?: Env,
      workerCtx?: CfFetchCtx,
    ) => Response | Promise<Response>;
    return run(request, env, ctx);
  },

  async scheduled(
    _event: { cron: string; scheduledTime: number },
    env: Env,
    ctx: { waitUntil(promise: Promise<unknown>): void },
  ) {
    const id = `awards-${Date.now()}`;
    ctx.waitUntil(env.AWARDS_WORKFLOW.create({ id }));
  },
};
