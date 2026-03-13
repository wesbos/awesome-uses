declare module 'cloudflare:workers' {
  export const env: Record<string, unknown>;

  export class WorkflowEntrypoint<Env = unknown> {
    protected env: Env;
    run(event: WorkflowEvent<unknown>, step: WorkflowStep): Promise<unknown>;
  }

  export interface WorkflowEvent<T> {
    payload: T;
    timestamp: Date;
  }

  export interface WorkflowStep {
    do<T>(name: string, callback: () => Promise<T>): Promise<T>;
    do<T>(name: string, config: { retries?: { limit: number; delay?: string; backoff?: string }; timeout?: string }, callback: () => Promise<T>): Promise<T>;
    sleep(name: string, duration: string): Promise<void>;
    sleepUntil(name: string, timestamp: Date | string): Promise<void>;
  }
}
