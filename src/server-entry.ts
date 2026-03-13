import handler from '@tanstack/react-start/server-entry';

export { AwardsWorkflow } from './server/awards/workflow';

type WorkflowBinding = {
  create(options?: { id?: string; params?: unknown }): Promise<{ id: string }>;
};

type Env = {
  AWARDS_WORKFLOW: WorkflowBinding;
};

export default {
  fetch: handler.fetch,

  async scheduled(
    _event: { cron: string; scheduledTime: number },
    env: Env,
    ctx: { waitUntil(promise: Promise<unknown>): void },
  ) {
    const id = `awards-${Date.now()}`;
    ctx.waitUntil(env.AWARDS_WORKFLOW.create({ id }));
  },
};
