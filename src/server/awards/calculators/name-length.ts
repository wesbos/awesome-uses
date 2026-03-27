import type { DrizzleD1Database } from 'drizzle-orm/d1';
import type * as schemaImport from '../../schema';
import { getAllPeople } from '../../../lib/data';
import type { AwardDataMap } from '../types';
import { toPersonRef, EMPTY_PERSON_REF } from './person-ref';

export async function calculateLongestName(
  _db: DrizzleD1Database<typeof schemaImport>,
): Promise<AwardDataMap['longest-name']> {
  const sorted = [...getAllPeople()].sort(
    (a, b) => b.name.trim().length - a.name.trim().length,
  );
  const winner = sorted[0];
  if (!winner) {
    return { person: EMPTY_PERSON_REF, length: 0 };
  }
  return {
    person: toPersonRef(winner),
    length: winner.name.trim().length,
  };
}

export async function calculateShortestName(
  _db: DrizzleD1Database<typeof schemaImport>,
): Promise<AwardDataMap['shortest-name']> {
  const sorted = [...getAllPeople()].sort(
    (a, b) => a.name.trim().length - b.name.trim().length,
  );
  const winner = sorted[0];
  if (!winner) {
    return { person: EMPTY_PERSON_REF, length: 0 };
  }
  return {
    person: toPersonRef(winner),
    length: winner.name.trim().length,
  };
}
