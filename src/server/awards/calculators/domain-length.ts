import type { DrizzleD1Database } from 'drizzle-orm/d1';
import type * as schemaImport from '../../schema';
import { getAllPeople } from '../../../lib/data';
import type { AwardDataMap } from '../types';
import { toPersonRef, EMPTY_PERSON_REF } from './person-ref';

function getPeopleWithDomains() {
  return getAllPeople().map((p) => {
    const host = new URL(p.url).hostname.replace(/^www\./, '');
    return { domain: host, person: toPersonRef(p) };
  });
}

export async function calculateLongestDomain(
  _db: DrizzleD1Database<typeof schemaImport>,
): Promise<AwardDataMap['longest-domain']> {
  const withDomains = getPeopleWithDomains().sort(
    (a, b) => b.domain.length - a.domain.length,
  );
  const winner = withDomains[0];
  if (!winner) {
    return { domain: '', length: 0, person: EMPTY_PERSON_REF };
  }
  return {
    domain: winner.domain,
    length: winner.domain.length,
    person: winner.person,
  };
}

export async function calculateShortestDomain(
  _db: DrizzleD1Database<typeof schemaImport>,
): Promise<AwardDataMap['shortest-domain']> {
  const withDomains = getPeopleWithDomains().sort(
    (a, b) => a.domain.length - b.domain.length,
  );
  const winner = withDomains[0];
  if (!winner) {
    return { domain: '', length: 0, person: EMPTY_PERSON_REF };
  }
  return {
    domain: winner.domain,
    length: winner.domain.length,
    person: winner.person,
  };
}
