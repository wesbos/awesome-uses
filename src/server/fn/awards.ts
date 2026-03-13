import { createServerFn } from '@tanstack/react-start';
import { getAllAwards, upsertAward } from '../db/index.server';
import { resolveDb } from '../db/connection.server';
import { AWARD_REGISTRY, ALL_AWARD_KEYS } from '../awards/registry';
import type { AwardKey, AnyAward } from '../awards/types';

export const $getAwards = createServerFn({ method: 'GET' }).handler(
  async (): Promise<AnyAward[]> => {
    return getAllAwards();
  },
);

export const $recalculateAward = createServerFn({ method: 'POST' })
  .inputValidator((awardKey: string) => awardKey)
  .handler(async ({ data: awardKey }): Promise<AnyAward | null> => {
    const entry = AWARD_REGISTRY[awardKey as AwardKey];
    if (!entry) {
      console.log(`[awards] Unknown award key: ${awardKey}`);
      return null;
    }

    const db = resolveDb();
    if (!db) {
      console.log('[awards] No database available for award calculation');
      return null;
    }

    const data = await entry.calculate(db);
    await upsertAward(entry.key, entry.title, entry.description, data);

    return {
      awardKey: entry.key,
      title: entry.title,
      description: entry.description,
      data,
      calculatedAt: new Date().toISOString(),
    } as AnyAward;
  });

export type RecalculateAllResult = {
  calculated: string[];
  failed: string[];
};

export const $recalculateAllAwards = createServerFn({ method: 'POST' }).handler(
  async (): Promise<RecalculateAllResult> => {
    const db = resolveDb();
    if (!db) {
      console.log('[awards] No database available for award calculation');
      return { calculated: [], failed: ALL_AWARD_KEYS as string[] };
    }

    const calculated: string[] = [];
    const failed: string[] = [];

    for (const key of ALL_AWARD_KEYS) {
      const entry = AWARD_REGISTRY[key];
      try {
        const data = await entry.calculate(db);
        await upsertAward(entry.key, entry.title, entry.description, data);
        calculated.push(key);
      } catch (error) {
        console.log(`[awards] Failed to calculate ${key}:`, error);
        failed.push(key);
      }
    }

    return { calculated, failed };
  },
);
