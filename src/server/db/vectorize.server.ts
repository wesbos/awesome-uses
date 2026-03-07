import { env as cfEnv } from 'cloudflare:workers';

type VectorizeMatch = {
  id: string;
  score: number;
  metadata?: Record<string, string> | null;
};

type VectorizeQueryResult = {
  count: number;
  matches: VectorizeMatch[];
};

export type VectorizeVector = {
  id: string;
  values: number[];
  metadata?: Record<string, string>;
};

export type VectorizeIndex = {
  queryById(
    id: string,
    options?: { topK?: number; returnMetadata?: 'none' | 'indexed' | 'all'; returnValues?: boolean },
  ): Promise<VectorizeQueryResult>;
  upsert(vectors: VectorizeVector[]): Promise<{ mutationId: string }>;
  getByIds(ids: string[]): Promise<VectorizeVector[]>;
};

export function resolveVectorize(): VectorizeIndex | null {
  return (cfEnv as { VECTORIZE?: VectorizeIndex }).VECTORIZE ?? null;
}
