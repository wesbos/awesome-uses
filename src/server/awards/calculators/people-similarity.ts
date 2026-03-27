import type { DrizzleD1Database } from 'drizzle-orm/d1';
import type * as schemaImport from '../../schema';
import { getAllPeople } from '../../../lib/data';
import { getHealthyScrapedPersonSlugs } from '../../db/index.server';
import { resolveVectorize, type VectorizeVector } from '../../db/vectorize.server';
import type { AwardDataMap, PersonRef } from '../types';
import { toPersonRef, EMPTY_PERSON_REF } from './person-ref';

function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  if (denom === 0) return 0;
  return dot / denom;
}

type ScoredPair = {
  personA: PersonRef;
  personB: PersonRef;
  score: number;
};

async function loadVectors(): Promise<VectorizeVector[]> {
  console.log('[award:people-similarity] Starting vector load');

  const vectorize = resolveVectorize();
  if (!vectorize) {
    console.log('[award:people-similarity] No Vectorize binding available — cannot compute similarity');
    return [];
  }
  console.log('[award:people-similarity] Vectorize binding resolved');

  const scrapedSlugs = await getHealthyScrapedPersonSlugs();
  console.log(`[award:people-similarity] Found ${scrapedSlugs.length} healthy (200) person slugs`);
  if (scrapedSlugs.length < 2) {
    console.log('[award:people-similarity] Need at least 2 scraped people, aborting');
    return [];
  }

  const batchSize = 20;
  const allVectors: VectorizeVector[] = [];
  const totalBatches = Math.ceil(scrapedSlugs.length / batchSize);

  for (let i = 0; i < scrapedSlugs.length; i += batchSize) {
    const batchNum = Math.floor(i / batchSize) + 1;
    const batch = scrapedSlugs.slice(i, i + batchSize);
    console.log(`[award:people-similarity] Fetching vectors batch ${batchNum}/${totalBatches} (${batch.length} slugs)`);
    try {
      const vectors = await vectorize.getByIds(batch);
      const valid = vectors.filter((v) => v.values?.length > 0);
      console.log(`[award:people-similarity] Batch ${batchNum}: got ${vectors.length} vectors, ${valid.length} with values`);
      allVectors.push(...valid);
    } catch (error) {
      console.log(`[award:people-similarity] Batch ${batchNum} failed:`, error);
    }
  }

  console.log(`[award:people-similarity] Loaded ${allVectors.length} total vectors with embeddings`);
  return allVectors;
}

function scorePairs(
  vectors: VectorizeVector[],
  sort: 'asc' | 'desc',
  limit: number,
): ScoredPair[] {
  const allPeople = getAllPeople();
  const peopleMap = new Map(allPeople.map((p) => [p.personSlug, p]));

  const pairs: { idxA: number; idxB: number; score: number }[] = [];

  for (let i = 0; i < vectors.length; i++) {
    for (let j = i + 1; j < vectors.length; j++) {
      const score = cosineSimilarity(vectors[i].values, vectors[j].values);
      pairs.push({ idxA: i, idxB: j, score });
    }
  }

  if (sort === 'desc') {
    pairs.sort((a, b) => b.score - a.score);
  } else {
    pairs.sort((a, b) => a.score - b.score);
  }

  return pairs.slice(0, limit).map((p) => {
    const a = vectors[p.idxA];
    const b = vectors[p.idxB];
    const personA = peopleMap.get(a.id);
    const personB = peopleMap.get(b.id);
    return {
      personA: personA ? toPersonRef(personA) : { ...EMPTY_PERSON_REF, personSlug: a.id, name: a.id },
      personB: personB ? toPersonRef(personB) : { ...EMPTY_PERSON_REF, personSlug: b.id, name: b.id },
      score: Math.round(p.score * 1000) / 1000,
    };
  });
}

const EMPTY_RESULT = {
  personA: EMPTY_PERSON_REF,
  personB: EMPTY_PERSON_REF,
  score: 0,
  runnersUp: [],
};

export async function calculateMostSimilarPeople(
  _db: DrizzleD1Database<typeof schemaImport>,
): Promise<AwardDataMap['most-similar-people']> {
  console.log('[award:most-similar-people] Starting calculation');
  const vectors = await loadVectors();
  if (vectors.length < 2) {
    console.log(`[award:most-similar-people] Only ${vectors.length} vectors — need at least 2, returning empty`);
    return EMPTY_RESULT;
  }

  const totalPairs = (vectors.length * (vectors.length - 1)) / 2;
  console.log(`[award:most-similar-people] Computing ${totalPairs} pairs from ${vectors.length} vectors`);

  const topPairs = scorePairs(vectors, 'desc', 6);
  if (topPairs.length === 0) {
    console.log('[award:most-similar-people] No pairs scored, returning empty');
    return EMPTY_RESULT;
  }

  console.log(`[award:most-similar-people] Winner: ${topPairs[0].personA.name} & ${topPairs[0].personB.name} (score: ${topPairs[0].score})`);
  return {
    ...topPairs[0],
    runnersUp: topPairs.slice(1),
  };
}

export async function calculateMostOppositePeople(
  _db: DrizzleD1Database<typeof schemaImport>,
): Promise<AwardDataMap['most-opposite-people']> {
  console.log('[award:most-opposite-people] Starting calculation');
  const vectors = await loadVectors();
  if (vectors.length < 2) {
    console.log(`[award:most-opposite-people] Only ${vectors.length} vectors — need at least 2, returning empty`);
    return EMPTY_RESULT;
  }

  const totalPairs = (vectors.length * (vectors.length - 1)) / 2;
  console.log(`[award:most-opposite-people] Computing ${totalPairs} pairs from ${vectors.length} vectors`);

  const bottomPairs = scorePairs(vectors, 'asc', 6);
  if (bottomPairs.length === 0) {
    console.log('[award:most-opposite-people] No pairs scored, returning empty');
    return EMPTY_RESULT;
  }

  console.log(`[award:most-opposite-people] Winner: ${bottomPairs[0].personA.name} & ${bottomPairs[0].personB.name} (score: ${bottomPairs[0].score})`);
  return {
    ...bottomPairs[0],
    runnersUp: bottomPairs.slice(1),
  };
}
