import { createServerFn } from '@tanstack/react-start';
import type OpenAI from 'openai';
import { kmeans } from 'ml-kmeans';
import { UMAP } from 'umap-js';
import { getAllPeople } from '../../lib/data';
import {
  deletePersonItems,
  getAllScrapedPersonSlugs,
  getItemsByPerson,
  getPersonItems,
  getProfilesForVectorization,
  getScrapedPagesForExtraction,
  insertPersonItems,
} from '../db/index.server';
import { resolveVectorize, type VectorizeVector } from '../db/vectorize.server';
import { createOpenAIClient, extractItemsFromMarkdown, normalizeItems } from '../extract';
import { mapConcurrent, BATCH_CONCURRENCY, slugToFace, type Face } from './helpers';
import { vectorizeProfile } from './vectorize.server';

type BatchExtractInput = {
  limit: number;
  skipExisting: boolean;
};

export type BatchExtractResult = {
  processed: number;
  totalItems: number;
  errors: number;
  results: Array<{ personSlug: string; itemCount: number; error?: string }>;
};

export const $batchExtractItems = createServerFn({ method: 'POST' })
  .inputValidator((input: BatchExtractInput) => input)
  .handler(async ({ data }): Promise<BatchExtractResult> => {
    const pages = await getScrapedPagesForExtraction({
      skipExisting: data.skipExisting,
      limit: data.limit,
    });

    if (pages.length === 0) {
      return { processed: 0, totalItems: 0, errors: 0, results: [] };
    }

    let client: OpenAI;
    try {
      client = createOpenAIClient();
    } catch {
      return { processed: 0, totalItems: 0, errors: 0, results: [{ personSlug: '', itemCount: 0, error: 'OPENAI_API_KEY not configured' }] };
    }

    let totalItems = 0;
    let errors = 0;

    const results = await mapConcurrent(pages, BATCH_CONCURRENCY, async (page) => {
      try {
        const extraction = await extractItemsFromMarkdown(client, page.contentMarkdown);
        const normalized = normalizeItems(extraction.items);

        if (normalized.length > 0) {
          await deletePersonItems(page.personSlug);
          const extractedAt = new Date().toISOString();
          const rows = normalized.map((item) => ({
            personSlug: page.personSlug,
            item: item.item.trim(),
            tagsJson: JSON.stringify(item.tags),
            detail: item.detail,
            extractedAt,
          }));
          await insertPersonItems(rows);
          totalItems += normalized.length;
        }

        return { personSlug: page.personSlug, itemCount: normalized.length };
      } catch (err) {
        errors++;
        return {
          personSlug: page.personSlug,
          itemCount: 0,
          error: err instanceof Error ? err.message : 'Extraction failed',
        };
      }
    });

    return { processed: pages.length, totalItems, errors, results };
  });

type BatchVectorizeInput = {
  limit: number;
  skipExisting: boolean;
};

export type BatchVectorizeResult = {
  processed: number;
  vectorized: number;
  errors: number;
};

export const $batchVectorize = createServerFn({ method: 'POST' })
  .inputValidator((input: BatchVectorizeInput) => input)
  .handler(async ({ data }): Promise<BatchVectorizeResult> => {
    const profiles = await getProfilesForVectorization({
      skipExisting: data.skipExisting,
      limit: data.limit,
    });

    if (profiles.length === 0) {
      return { processed: 0, vectorized: 0, errors: 0 };
    }

    let client: OpenAI;
    try {
      client = createOpenAIClient();
    } catch {
      return { processed: 0, vectorized: 0, errors: 0 };
    }

    let vectorized = 0;
    let errors = 0;

    await mapConcurrent(profiles, BATCH_CONCURRENCY, async (profile) => {
      try {
        const items = await getPersonItems(profile.personSlug);
        await vectorizeProfile(
          profile.personSlug,
          profile.contentMarkdown,
          items.map((i) => i.item),
          client,
        );
        vectorized++;
      } catch {
        errors++;
      }
    });

    return { processed: profiles.length, vectorized, errors };
  });

export type SimilarPerson = Face & { score: number };

export type VectorizeDebug = {
  hasBinding: boolean;
  personSlug: string;
  rawJson: string;
  error: string | null;
};

export const $getSimilarPeople = createServerFn({ method: 'GET' })
  .inputValidator((personSlug: string) => personSlug)
  .handler(async ({ data: personSlug }): Promise<{ similar: SimilarPerson[]; debug: VectorizeDebug }> => {
    const vectorize = resolveVectorize();
    const debug: VectorizeDebug = {
      hasBinding: !!vectorize,
      personSlug,
      rawJson: '{}',
      error: null,
    };

    if (!vectorize) return { similar: [], debug };

    try {
      const results = await vectorize.queryById(personSlug, {
        topK: 7,
        returnMetadata: 'none',
      });

      debug.rawJson = JSON.stringify(results, null, 2);

      if (!results?.matches?.length) return { similar: [], debug };

      const allPeople = getAllPeople();
      const peopleMap = new Map(allPeople.map((p) => [p.personSlug, p]));

      const similar = results.matches
        .filter((m) => m.id !== personSlug && m.score > 0.3)
        .slice(0, 6)
        .map((match) => {
          const face = slugToFace(match.id, peopleMap);
          if (!face) return null;
          return { ...face, score: match.score };
        })
        .filter((f): f is SimilarPerson => f !== null);

      return { similar, debug };
    } catch (err) {
      debug.error = err instanceof Error ? err.message : String(err);
      return { similar: [], debug };
    }
  });

export type GalaxyPoint = {
  personSlug: string;
  x: number;
  y: number;
  cluster: number;
};

export type ClusterInfo = {
  id: number;
  label: string;
  topItems: string[];
  count: number;
};

export type GalaxyData = {
  points: GalaxyPoint[];
  clusters: ClusterInfo[];
};

function labelCluster(
  clusterIdx: number,
  memberSlugs: string[],
  itemsByPerson: Map<string, string[]>,
): { label: string; topItems: string[] } {
  const itemCounts = new Map<string, number>();
  for (const slug of memberSlugs) {
    for (const item of itemsByPerson.get(slug) ?? []) {
      itemCounts.set(item, (itemCounts.get(item) || 0) + 1);
    }
  }
  const sorted = [...itemCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([item]) => item);
  const topItems = sorted.slice(0, 8);
  const label = topItems.slice(0, 3).join(', ') || `Cluster ${clusterIdx + 1}`;
  return { label, topItems };
}

export const $getGalaxyData = createServerFn({ method: 'GET' }).handler(
  async (): Promise<GalaxyData> => {
    const vectorize = resolveVectorize();
    if (!vectorize) return { points: [], clusters: [] };

    const scrapedSlugs = await getAllScrapedPersonSlugs();
    if (scrapedSlugs.length < 5) return { points: [], clusters: [] };

    const batchSize = 20;
    const allVectors: VectorizeVector[] = [];
    for (let i = 0; i < scrapedSlugs.length; i += batchSize) {
      const batch = scrapedSlugs.slice(i, i + batchSize);
      const vectors = await vectorize.getByIds(batch);
      allVectors.push(...vectors.filter((v) => v.values?.length > 0));
    }

    if (allVectors.length < 5) return { points: [], clusters: [] };

    const slugs = allVectors.map((v) => v.id);
    const embeddings = allVectors.map((v) => v.values);

    const nNeighbors = Math.max(2, Math.min(15, Math.floor(embeddings.length / 2)));
    const umap = new UMAP({
      nComponents: 2,
      nNeighbors,
      minDist: 0.1,
      spread: 1.0,
    });
    const positions = umap.fit(embeddings);

    const numClusters = Math.min(12, Math.floor(embeddings.length / 3));
    const kResult = kmeans(embeddings, Math.max(2, numClusters), { initialization: 'kmeans++' });

    const itemsByPerson = await getItemsByPerson();

    const points: GalaxyPoint[] = slugs.map((slug, i) => ({
      personSlug: slug,
      x: positions[i][0],
      y: positions[i][1],
      cluster: kResult.clusters[i],
    }));

    const clusterMembers = new Map<number, string[]>();
    for (const point of points) {
      if (!clusterMembers.has(point.cluster)) clusterMembers.set(point.cluster, []);
      clusterMembers.get(point.cluster)!.push(point.personSlug);
    }

    const clusters: ClusterInfo[] = [...clusterMembers.entries()]
      .map(([id, members]) => {
        const { label, topItems } = labelCluster(id, members, itemsByPerson);
        return { id, label, topItems, count: members.length };
      })
      .sort((a, b) => b.count - a.count);

    return { points, clusters };
  },
);
