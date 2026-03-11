import { createServerFn } from '@tanstack/react-start';
import { kmeans } from 'ml-kmeans';
import { UMAP } from 'umap-js';
import { getAllPeople } from '../../lib/data';
import {
  applyTagReclassification,
  getAllTagSummaries,
  getAllTagVectors,
  getTagDetailBySlug,
  getTagVectorSlugs,
  upsertTagVector,
  type TagSummary,
  type TagDetail,
  type ReclassifyAssignment,
} from '../db/index.server';
import { createOpenAIClient } from '../extract';
import { previewTagReclassification } from '../reclassify';
import { slugToFace, type Face, type TagItemWithFaces } from './helpers';

export type TagSummaryWithFaces = Omit<TagSummary, 'topItems' | 'personSlugs'> & {
  faces: Face[];
  topItems: TagItemWithFaces[];
};

export const $getTagSummaries = createServerFn({ method: 'GET' }).handler(
  async (): Promise<TagSummaryWithFaces[]> => {
    const tags = await getAllTagSummaries();
    const allPeople = getAllPeople();
    const peopleMap = new Map(allPeople.map((p) => [p.personSlug, p]));

    return tags.map((tag) => ({
      ...tag,
      faces: tag.personSlugs
        .map((slug) => slugToFace(slug, peopleMap))
        .filter((f): f is Face => f !== null),
      topItems: tag.topItems.map((ti) => ({
        item: ti.item,
        itemSlug: ti.itemSlug,
        count: ti.count,
        faces: ti.personSlugs
          .map((slug) => slugToFace(slug, peopleMap))
          .filter((f): f is Face => f !== null),
      })),
    }));
  }
);

export type TagDetailWithFaces = Omit<TagDetail, 'people' | 'items'> & {
  faces: Face[];
  items: TagItemWithFaces[];
};

export const $getTagDetail = createServerFn({ method: 'GET' })
  .inputValidator((tagSlug: string) => tagSlug)
  .handler(async ({ data: tagSlug }): Promise<TagDetailWithFaces | null> => {
    const detail = await getTagDetailBySlug(tagSlug);
    if (!detail) return null;

    const allPeople = getAllPeople();
    const peopleMap = new Map(allPeople.map((p) => [p.personSlug, p]));

    return {
      tag: detail.tag,
      tagSlug: detail.tagSlug,
      totalItems: detail.totalItems,
      totalPeople: detail.totalPeople,
      faces: detail.people
        .map((slug) => slugToFace(slug, peopleMap))
        .filter((f): f is Face => f !== null),
      items: detail.items.map((item) => ({
        item: item.item,
        itemSlug: item.itemSlug,
        count: item.count,
        faces: item.personSlugs
          .map((slug) => slugToFace(slug, peopleMap))
          .filter((f): f is Face => f !== null),
      })),
    };
  });

type ReclassifyPreviewInput = {
  tag: string;
  minUsers: number;
  limit: number;
  prompt?: string;
  model?: string;
};

export type ReclassifyPreviewPayload = Awaited<
  ReturnType<typeof previewTagReclassification>
>;

export const $previewTagReclassify = createServerFn({ method: 'POST' })
  .inputValidator((input: ReclassifyPreviewInput) => input)
  .handler(async ({ data }) => {
    return previewTagReclassification(data);
  });

type ApplyReclassifyInput = {
  tag: string;
  assignments: ReclassifyAssignment[];
};

export const $applyTagReclassify = createServerFn({ method: 'POST' })
  .inputValidator((input: ApplyReclassifyInput) => input)
  .handler(async ({ data }) => {
    return applyTagReclassification(data.tag, data.assignments);
  });

// ---------------------------------------------------------------------------
// Tag Vectorization & Galaxy
// ---------------------------------------------------------------------------

const EMBEDDING_MODEL = 'text-embedding-3-small';

type BatchVectorizeTagsInput = {
  skipExisting: boolean;
};

export type BatchVectorizeTagsResult = {
  processed: number;
  vectorized: number;
  errors: number;
};

export const $batchVectorizeTags = createServerFn({ method: 'POST' })
  .inputValidator((input: BatchVectorizeTagsInput) => input)
  .handler(async ({ data }): Promise<BatchVectorizeTagsResult> => {
    const tagSummaries = await getAllTagSummaries();

    let candidates = tagSummaries.map((t) => ({
      tag: t.tag,
      tagSlug: t.tagSlug,
      totalItems: t.totalItems,
      totalPeople: t.totalPeople,
      topItems: t.topItems.slice(0, 10).map((i) => i.item),
    }));

    if (data.skipExisting) {
      const existingSlugs = await getTagVectorSlugs();
      candidates = candidates.filter((c) => !existingSlugs.has(c.tagSlug));
    }

    if (candidates.length === 0) {
      return { processed: 0, vectorized: 0, errors: 0 };
    }

    let client;
    try {
      client = createOpenAIClient();
    } catch (err) {
      console.log('[batchVectorizeTags] Failed to create OpenAI client:', err);
      return { processed: 0, vectorized: 0, errors: 0 };
    }

    // Tags are few enough to embed in one batch
    const inputs = candidates.map((t) => {
      const parts = [`Tag: ${t.tag}`];
      if (t.topItems.length > 0) parts.push(`Example items: ${t.topItems.join(', ')}`);
      parts.push(`Used by ${t.totalPeople} people across ${t.totalItems} items`);
      return parts.join('\n');
    });

    let vectorized = 0;
    let errors = 0;

    try {
      const response = await client.embeddings.create({
        model: EMBEDDING_MODEL,
        input: inputs,
        dimensions: 1536,
      });

      for (let i = 0; i < candidates.length; i++) {
        const embedding = response.data[i]?.embedding;
        if (embedding?.length) {
          await upsertTagVector(candidates[i].tagSlug, candidates[i].tag, embedding);
          vectorized++;
        } else {
          errors++;
        }
      }
    } catch (err) {
      console.log('[batchVectorizeTags] Embedding failed:', err);
      errors += candidates.length;
    }

    return { processed: candidates.length, vectorized, errors };
  });

// Tag Galaxy types

type TagGalaxyInput = {
  clusters: number;
  neighbors: number;
  minDist: number;
  spread: number;
  clusterOn: 'embeddings' | 'umap';
};

export type TagGalaxyPoint = {
  tagSlug: string;
  tagName: string;
  x: number;
  y: number;
  cluster: number;
  totalItems: number;
  totalPeople: number;
  topItems: string[];
};

export type TagClusterInfo = {
  id: number;
  count: number;
  topTags: string[];
  allTags: string[];
};

export type TagGalaxyData = {
  points: TagGalaxyPoint[];
  clusters: TagClusterInfo[];
  vectorCount: number;
};

export const $getTagGalaxyData = createServerFn({ method: 'GET' })
  .inputValidator((input: TagGalaxyInput) => input)
  .handler(async ({ data: params }): Promise<TagGalaxyData> => {
    const vectors = await getAllTagVectors();
    const vectorCount = vectors.length;

    if (vectors.length < 5) {
      return { points: [], clusters: [], vectorCount };
    }

    const tagSummaries = await getAllTagSummaries();
    const summaryMap = new Map(tagSummaries.map((t) => [t.tagSlug, t]));

    const slugs = vectors.map((v) => v.tagSlug);
    const embeddings = vectors.map((v) => v.embedding);

    // UMAP
    const nNeighbors = Math.max(2, Math.min(params.neighbors, Math.floor(embeddings.length / 2)));
    const umap = new UMAP({
      nComponents: 2,
      nNeighbors,
      minDist: params.minDist,
      spread: params.spread,
    });
    const positions = umap.fit(embeddings);

    // K-means
    const clusterInput = params.clusterOn === 'umap' ? positions : embeddings;
    const numClusters = Math.max(2, Math.min(params.clusters, Math.floor(embeddings.length / 2)));
    const kResult = kmeans(clusterInput, numClusters, { initialization: 'kmeans++' });

    // Build points
    const points: TagGalaxyPoint[] = slugs.map((slug, i) => {
      const summary = summaryMap.get(slug);
      return {
        tagSlug: slug,
        tagName: vectors[i].tagName,
        x: positions[i][0],
        y: positions[i][1],
        cluster: kResult.clusters[i],
        totalItems: summary?.totalItems ?? 0,
        totalPeople: summary?.totalPeople ?? 0,
        topItems: summary?.topItems.slice(0, 5).map((it) => it.item) ?? [],
      };
    });

    // Build cluster info
    const clusterMembers = new Map<number, TagGalaxyPoint[]>();
    for (const point of points) {
      if (!clusterMembers.has(point.cluster)) clusterMembers.set(point.cluster, []);
      clusterMembers.get(point.cluster)!.push(point);
    }

    const clusters: TagClusterInfo[] = [...clusterMembers.entries()]
      .map(([id, members]) => {
        const sorted = members.sort((a, b) => b.totalPeople - a.totalPeople);
        return {
          id,
          count: members.length,
          topTags: sorted.slice(0, 10).map((m) => m.tagName),
          allTags: sorted.map((m) => m.tagName),
        };
      })
      .sort((a, b) => b.count - a.count);

    return { points, clusters, vectorCount };
  });
