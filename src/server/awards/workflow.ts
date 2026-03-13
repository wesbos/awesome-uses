import { WorkflowEntrypoint } from 'cloudflare:workers';
import type { WorkflowStep, WorkflowEvent } from 'cloudflare:workers';
import { drizzle } from 'drizzle-orm/d1';
import * as schema from '../schema';
import { AWARD_REGISTRY, ALL_AWARD_KEYS } from './registry';

type Env = {
  USES_SCRAPES_DB: Parameters<typeof drizzle>[0];
};

export class AwardsWorkflow extends WorkflowEntrypoint<Env> {
  async run(_event: WorkflowEvent<void>, step: WorkflowStep) {
    const results: { calculated: string[]; failed: string[] } = {
      calculated: [],
      failed: [],
    };

    for (const key of ALL_AWARD_KEYS) {
      const entry = AWARD_REGISTRY[key];

      await step.do(`calculate-${key}`, async () => {
        const db = drizzle(this.env.USES_SCRAPES_DB, { schema });
        const data = await entry.calculate(db);
        const now = new Date().toISOString();
        const dataJson = JSON.stringify(data);

        await db
          .insert(schema.awards)
          .values({
            awardKey: entry.key,
            title: entry.title,
            description: entry.description,
            dataJson,
            calculatedAt: now,
          })
          .onConflictDoUpdate({
            target: schema.awards.awardKey,
            set: {
              title: entry.title,
              description: entry.description,
              dataJson,
              calculatedAt: now,
            },
          });

        results.calculated.push(key);
      });
    }

    return results;
  }
}
