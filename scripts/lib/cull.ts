import type { PersonRecord } from '../../src/lib/types';

export type CullCheckOutcome = {
  url: string;
  ok: boolean;
};

export function buildNextPeopleAfterCull(
  allPeople: PersonRecord[],
  checks: CullCheckOutcome[]
): { nextPeople: PersonRecord[]; removedCount: number } {
  const checkedUrlOutcome = checks.reduce<Map<string, boolean>>((acc, check) => {
    acc.set(check.url, check.ok);
    return acc;
  }, new Map<string, boolean>());

  const nextPeople = allPeople.filter((person) => {
    const outcome = checkedUrlOutcome.get(person.url);
    if (typeof outcome === 'boolean') {
      return outcome;
    }
    return true;
  });

  return {
    nextPeople,
    removedCount: allPeople.length - nextPeople.length,
  };
}
