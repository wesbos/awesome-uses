import type { DashboardPayload, DashboardRow } from '../server/fn/profiles';
import type { ItemsDashboardRow } from '../server/fn/items';
import type { ReclassifyPreviewPayload } from '../server/fn/tags';
import type { DiscoverCategoriesResult } from '../server/fn/admin';
import type { ExtractionReviewData } from '../server/db/index.server';
import type { BatchExtractResult, BatchVectorizeResult } from '../server/fn/vectorize';

type ToolCallEnvelope<T> =
  | {
      ok: true;
      tool: string;
      result: T;
    }
  | {
      ok: false;
      tool: string;
      error: {
        code: string;
        message: string;
        details?: unknown;
      };
    };

export type SiteToolMetadata = {
  name: string;
  scope: string;
  description: string;
};

type SiteToolsResponse = {
  ok: boolean;
  service: string;
  tools: SiteToolMetadata[];
};

async function parseJson<T>(response: Response): Promise<T> {
  return (await response.json()) as T;
}

export async function listSiteTools(): Promise<SiteToolMetadata[]> {
  const response = await fetch('/api/site-management');
  if (!response.ok) throw new Error('Failed to list site tools.');
  const payload = await parseJson<SiteToolsResponse>(response);
  return payload.tools ?? [];
}

export async function callSiteTool<T>(tool: string, input: unknown = {}): Promise<T> {
  const response = await fetch('/api/site-management', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ tool, input }),
  });

  const payload = await parseJson<ToolCallEnvelope<T>>(response);
  if (!payload.ok) {
    throw new Error(payload.error.message);
  }
  return payload.result;
}

export async function apiGetScrapeStatus(): Promise<DashboardPayload> {
  return callSiteTool<DashboardPayload>('pipeline.getScrapeStatus');
}

export async function apiScrapePerson(
  personSlug: string,
  input?: { timeoutMs?: number; retries?: number },
): Promise<{
  personSlug: string;
  statusCode: number | null;
  fetchedAt: string;
  title: string | null;
  changeType: string;
}> {
  return callSiteTool('pipeline.scrapePerson', {
    personSlug,
    timeoutMs: input?.timeoutMs ?? 12000,
    retries: input?.retries ?? 1,
  });
}

export async function apiRescrapeAndExtract(personSlug: string): Promise<{
  personSlug: string;
  scraped: boolean;
  contentChanged: boolean;
  extracted: boolean;
  itemCount: number;
  error?: string;
}> {
  return callSiteTool('pipeline.rescrapeAndExtractPerson', { personSlug });
}

export async function apiGetErrorPeople(): Promise<
  Array<{
    personSlug: string;
    name: string;
    url: string;
    statusCode: number | null;
    fetchedAt: string;
    title: string | null;
  }>
> {
  return callSiteTool('pipeline.getScrapeErrors', { limit: 500 });
}

export async function apiGetCategories(): Promise<string[]> {
  const payload = await callSiteTool<{
    total: number;
    rows: Array<{ category: string }>;
  }>('categories.list', {});
  return payload.rows.map((entry) => entry.category);
}

export async function apiPreviewTagReclassify(input: {
  category: string;
  minUsers: number;
  limit: number;
  prompt?: string;
}): Promise<ReclassifyPreviewPayload> {
  return callSiteTool('pipeline.previewReclassification', input);
}

export async function apiApplyTagReclassify(input: {
  category: string;
  assignments: Array<{ item: string; categories: string[] }>;
}): Promise<{ updatedRows: number; updatedItems: number }> {
  return callSiteTool('pipeline.applyReclassification', input);
}

export async function apiGetExtractionReview(): Promise<ExtractionReviewData> {
  return callSiteTool('pipeline.reviewExtraction');
}

export async function apiDiscoverCategories(sampleSize: number): Promise<DiscoverCategoriesResult> {
  return callSiteTool('pipeline.discoverCategories', { sampleSize });
}

export async function apiGetItemsDashboard(): Promise<ItemsDashboardRow[]> {
  const payload = await callSiteTool<{
    total: number;
    rows: ItemsDashboardRow[];
  }>('items.list', { limit: 5000, offset: 0 });
  return payload.rows;
}

export async function apiEnrichItems(
  items: Array<{ item: string; tags: string[] }>,
): Promise<
  Array<{
    item: string;
    itemType: string | null;
    description: string | null;
    itemUrl: string | null;
    error?: string;
  }>
> {
  return callSiteTool('items.enrichBatch', { items });
}

export async function apiSearchItems(query: string): Promise<Array<{ item: string; itemSlug: string; count: number }>> {
  const payload = await callSiteTool<{
    total: number;
    rows: Array<{ item: string; itemSlug: string; count: number }>;
  }>('items.list', { q: query, limit: 50, offset: 0 });
  return payload.rows;
}

export async function apiMergeItems(input: {
  canonicalItem: string;
  sourceItems: string[];
}): Promise<{
  canonicalItem: string;
  mergedItems: string[];
  upsertedRows: number;
  deletedRows: number;
}> {
  return callSiteTool('items.merge', input);
}

export async function apiBatchExtractItems(input: {
  limit: number;
  skipExisting: boolean;
}): Promise<BatchExtractResult> {
  const result = await callSiteTool<{
    processed: number;
    totalItems: number;
    errors: number;
    rows: Array<{ personSlug: string; itemCount: number; error?: string }>;
  }>('pipeline.extractBatch', input);
  return {
    processed: result.processed,
    totalItems: result.totalItems,
    errors: result.errors,
    results: result.rows,
  };
}

export async function apiBatchVectorize(input: {
  limit: number;
  skipExisting: boolean;
}): Promise<BatchVectorizeResult> {
  const result = await callSiteTool<{
    processed: number;
    vectorized: number;
    errors: number;
  }>('pipeline.vectorizeBatch', input);
  return result;
}

export async function apiFindDuplicateItems(): Promise<
  Array<{
    canonical: string;
    canonicalCount: number;
    variants: Array<{ item: string; count: number }>;
  }>
> {
  const result = await callSiteTool<{
    totalGroups: number;
    rows: Array<{
      canonical: string;
      canonicalCount: number;
      variants: Array<{ item: string; count: number }>;
    }>;
  }>('items.findDuplicates', { minVariants: 2 });
  return result.rows;
}

export async function apiGetScrapedProfileRow(personSlug: string): Promise<DashboardRow | null> {
  const status = await apiGetScrapeStatus();
  return status.rows.find((row) => row.personSlug === personSlug) ?? null;
}
