import { z } from 'zod';
import { eq, inArray } from 'drizzle-orm';
import { Jimp } from 'jimp';
import OpenAI from 'openai';
import * as schema from '../../server/schema';
import { defineTool } from '../registry';
import type { ToolDefinition } from '../types';
import { getAvatarUrl, getDirectAvatarUrl } from '../../lib/avatar';
import { resolveAvatarsBucket } from '../../server/avatars-bucket.server';
import { getAllPeople, type PersonWithSlug } from './utils';

/** Write a debug PNG to R2 under _debug/<batchTs>/ and log a localhost URL. */
let debugBatchPrefix: string | null = null;
async function debugImage(pngBuffer: Buffer, filename: string, label?: string) {
  try {
    const bucket = resolveAvatarsBucket();
    if (!bucket) {
      console.log(`[avatars debug] no R2 bucket, skipping ${filename}`);
      return;
    }
    if (!debugBatchPrefix) {
      debugBatchPrefix = `_debug/${new Date().toISOString().replace(/[:.]/g, '-')}`;
    }
    const key = `${debugBatchPrefix}/${filename}`;
    const ab = new Uint8Array(pngBuffer).buffer as ArrayBuffer;
    await bucket.put(key, ab, { httpMetadata: { contentType: 'image/png' } });
    console.log(`[avatars debug] ${label ?? filename} → http://localhost:7535/api/avatar-debug/${key}`);
  } catch (err) {
    console.log(`[avatars debug] could not write ${filename}:`, err);
  }
}

const GRID_SIZE = 3;
/** Gemini / Nano Banana Flash image output is 1024×1024; 3 columns (and rows) split as 342+341+341 */
const GRID_PIXELS = 1024;
const CELL_SEGMENTS = [342, 341, 341] as const;

function cellSegmentStarts(): [number, number, number] {
  return [0, CELL_SEGMENTS[0], CELL_SEGMENTS[0] + CELL_SEGMENTS[1]];
}

/** Pixel rect for batch index 0..8 in a 1024² 3×3 grid */
function cellBounds(gridIndex: number): { x: number; y: number; w: number; h: number } {
  const col = gridIndex % GRID_SIZE;
  const row = Math.floor(gridIndex / GRID_SIZE);
  const xs = cellSegmentStarts();
  const ys = cellSegmentStarts();
  return {
    x: xs[col],
    y: ys[row],
    w: CELL_SEGMENTS[col],
    h: CELL_SEGMENTS[row],
  };
}

const GRID_LINE_INSET = 4;

/** Like cellBounds but inset by GRID_LINE_INSET on edges adjacent to other cells to discard grid lines. */
function cellBoundsInset(gridIndex: number): { x: number; y: number; w: number; h: number } {
  const col = gridIndex % GRID_SIZE;
  const row = Math.floor(gridIndex / GRID_SIZE);
  const { x, y, w, h } = cellBounds(gridIndex);
  const inL = col > 0 ? GRID_LINE_INSET : 0;
  const inR = col < GRID_SIZE - 1 ? GRID_LINE_INSET : 0;
  const inT = row > 0 ? GRID_LINE_INSET : 0;
  const inB = row < GRID_SIZE - 1 ? GRID_LINE_INSET : 0;
  return {
    x: x + inL,
    y: y + inT,
    w: w - inL - inR,
    h: h - inT - inB,
  };
}

/** Stored avatar size (square thumbs after crop) */
const EXPORT_AVATAR_PX = 512;

type AvatarStatusRowShape = {
  personSlug: string;
  name: string;
  status: string;
  generatedAt: string | null;
  error: string | null;
  sourceAvatarUrl: string;
};

/** Newest stipples first; in-flight and failures before the long pending tail */
function sortAvatarStatusRows(rows: AvatarStatusRowShape[]): AvatarStatusRowShape[] {
  const rank: Record<string, number> = {
    processing: 0,
    completed: 1,
    failed: 2,
    skipped_no_source: 3,
    pending: 4,
    none: 5,
  };
  return [...rows].sort((a, b) => {
    const ra = rank[a.status] ?? 9;
    const rb = rank[b.status] ?? 9;
    if (ra !== rb) return ra - rb;
    if (a.status === 'completed' && b.status === 'completed') {
      const ta = a.generatedAt ? new Date(a.generatedAt).getTime() : 0;
      const tb = b.generatedAt ? new Date(b.generatedAt).getTime() : 0;
      return tb - ta;
    }
    return a.name.localeCompare(b.name);
  });
}

// ── avatars.getStatus ──────────────────────────────────────────────

const getStatusInputSchema = z.object({});

const getStatusTool = defineTool({
  name: 'avatars.getStatus',
  scope: 'avatars',
  description: 'Get the status of avatar generation for all people.',
  inputSchema: getStatusInputSchema,
  async handler(context) {
    const people = getAllPeople();
    const rows = await context.db
      .select()
      .from(schema.generatedAvatars)
      .all();

    const statusMap = new Map(rows.map((r) => [r.personSlug, r]));

    let completed = 0;
    let pending = 0;
    let processing = 0;
    let failed = 0;
    let skipped = 0;

    const result = people.map((p) => {
      const row = statusMap.get(p.personSlug);
      const status = row?.status ?? 'none';
      if (status === 'completed') completed++;
      else if (status === 'processing') processing++;
      else if (status === 'failed') failed++;
      else if (status === 'skipped_no_source') skipped++;
      else pending++;
      return {
        personSlug: p.personSlug,
        name: p.name,
        status,
        generatedAt: row?.generatedAt ?? null,
        error: row?.error ?? null,
        sourceAvatarUrl: getAvatarUrl(p),
      };
    });

    return {
      total: people.length,
      completed,
      pending,
      processing,
      failed,
      skipped,
      rows: sortAvatarStatusRows(result),
    };
  },
});

// ── avatars.generateBatch ──────────────────────────────────────────

const generateBatchInputSchema = z.object({
  count: z.number().int().positive().max(9).default(9),
  /** Skip this many candidates before building the pool. Use to run parallel batches without overlap. */
  offset: z.number().int().min(0).default(0),
  /** Only people with status failed (up to count). Use to retry after fixing R2 etc. */
  failedOnly: z.boolean().optional(),
});

const generateBatchTool = defineTool({
  name: 'avatars.generateBatch',
  scope: 'avatars',
  description:
    'Generate stippled pen-and-ink avatars for a batch of people. Composes a 3x3 grid, sends to AI, slices results.',
  inputSchema: generateBatchInputSchema,
  async handler(context, input) {
    const log = (msg: string, extra?: unknown) => {
      if (extra !== undefined) console.log(`[avatars.generateBatch] ${msg}`, extra);
      else console.log(`[avatars.generateBatch] ${msg}`);
    };

    const avatarsBucket = resolveAvatarsBucket();
    if (!avatarsBucket) {
      return {
        batchId: null,
        processed: 0,
        message:
          'AVATARS_BUCKET is not bound. Run with wrangler or deploy — avatars are only marked complete after a successful R2 upload.',
      };
    }

    const people = getAllPeople();
    const existingRows = await context.db
      .select({
        personSlug: schema.generatedAvatars.personSlug,
        status: schema.generatedAvatars.status,
      })
      .from(schema.generatedAvatars)
      .all();

    const statusBySlug = new Map(existingRows.map((r) => [r.personSlug, r.status]));

    let candidates: PersonWithSlug[];
    if (input.failedOnly) {
      candidates = people.filter((p) => statusBySlug.get(p.personSlug) === 'failed');
    } else {
      const skipStatuses = new Set(['completed', 'skipped_no_source', 'failed']);
      candidates = people.filter((p) => !skipStatuses.has(statusBySlug.get(p.personSlug) ?? ''));
    }

    const targetCount = input.count;
    const offset = input.offset ?? 0;
    const poolStart = offset;
    const poolSize = Math.min(candidates.length - poolStart, targetCount * 20);
    const pool = candidates.slice(poolStart, poolStart + poolSize);

    log('start', {
      requestedCount: targetCount,
      offset,
      failedOnly: Boolean(input.failedOnly),
      totalPeople: people.length,
      alreadyCompleted: existingRows.filter((r) => r.status === 'completed').length,
      candidatePool: pool.length,
    });

    if (pool.length === 0) {
      const msg = input.failedOnly
        ? 'No failed avatars to regenerate.'
        : 'No candidates remaining.';
      log('no pool', { msg });
      return { batchId: null, processed: 0, message: msg };
    }

    const batchId = new Date().toISOString();

    // Try fetching source avatars from the pool until we fill `targetCount` slots
    type FetchedCell = { person: PersonWithSlug; img: Awaited<ReturnType<typeof Jimp.fromBuffer>> };
    const batch: FetchedCell[] = [];
    const skippedSlugs: string[] = [];

    log('fetching source avatars from pool…');
    for (const person of pool) {
      if (batch.length >= targetCount) break;

      const url = getDirectAvatarUrl(person);
      const shortUrl = url.length > 120 ? `${url.slice(0, 117)}…` : url;

      try {
        // log(`trying ${person.personSlug}…`, { url });
        const fetchHeaders: Record<string, string> = {};
        const unavatarKey = process.env.UNAVATAR_API_KEY;
        if (unavatarKey) fetchHeaders['x-api-key'] = unavatarKey;
        const response = await fetch(url, { signal: AbortSignal.timeout(10_000), headers: fetchHeaders });
        if (!response.ok) {
          log(`skip ${person.personSlug} — HTTP ${response.status}`, { url: shortUrl });
          skippedSlugs.push(person.personSlug);
          continue;
        }
        const contentType = response.headers.get('content-type') ?? '';
        if (!contentType.includes('image')) {
          log(`skip ${person.personSlug} — non-image content-type`, { contentType, url: shortUrl });
          skippedSlugs.push(person.personSlug);
          continue;
        }
        const arrayBuf = await response.arrayBuffer();
        const img = await Jimp.fromBuffer(Buffer.from(arrayBuf));
        log(`fetched ${person.personSlug}`, { bytes: arrayBuf.byteLength, contentType });
        batch.push({ person, img });
      } catch (err) {
        log(`skip ${person.personSlug} — fetch/decode
          \n
          error${url}`, err);
        skippedSlugs.push(person.personSlug);
        continue;
      }
    }

    // Mark skipped people as skipped_no_source so they won't be tried again
    if (skippedSlugs.length > 0) {
      log('marking skipped_no_source', skippedSlugs);
      for (const slug of skippedSlugs) {
        await context.db
          .insert(schema.generatedAvatars)
          .values({
            personSlug: slug,
            status: 'skipped_no_source',
            error: 'Source profile photo unavailable (404 / invalid). Fix social URLs and clear to retry.',
            batchId: null,
            gridPosition: null,
            generatedAt: null,
          })
          .onConflictDoUpdate({
            target: schema.generatedAvatars.personSlug,
            set: {
              status: 'skipped_no_source',
              error: 'Source profile photo unavailable (404 / invalid). Fix social URLs and clear to retry.',
              generatedAt: null,
            },
          })
          .run();
      }
    }

    if (batch.length === 0) {
      const msg = `Tried ${pool.length} candidate(s) but none had a fetchable source photo. ${skippedSlugs.length} marked skipped_no_source.`;
      log('no usable photos', { msg });
      return { batchId, processed: 0, message: msg };
    }

    log('batch filled', {
      filled: batch.length,
      target: targetCount,
      skipped: skippedSlugs.length,
      batchSlugs: batch.map((c) => c.person.personSlug),
    });

    // Mark batch rows as processing
    for (let i = 0; i < batch.length; i++) {
      await context.db
        .insert(schema.generatedAvatars)
        .values({
          personSlug: batch[i].person.personSlug,
          status: 'processing',
          batchId,
          gridPosition: i,
          generatedAt: null,
          error: null,
        })
        .onConflictDoUpdate({
          target: schema.generatedAvatars.personSlug,
          set: {
            status: 'processing',
            batchId,
            gridPosition: i,
            generatedAt: null,
            error: null,
          },
        })
        .run();
    }

    try {
      log(`composing ${batch.length} cells into ${GRID_PIXELS}×${GRID_PIXELS} grid`);

      const grid = new Jimp({ width: GRID_PIXELS, height: GRID_PIXELS, color: 0xffffffff });
      for (let i = 0; i < batch.length; i++) {
        const { x, y, w, h } = cellBounds(i);
        const img = batch[i].img.clone();
        img.resize({ w, h });
        grid.composite(img, x, y);
      }

      const gridPngBuffer = await grid.getBuffer('image/png');
      const gridBase64 = Buffer.from(gridPngBuffer).toString('base64');
      log('grid PNG ready', { base64Length: gridBase64.length });

      debugBatchPrefix = null;
      await debugImage(
        Buffer.from(gridPngBuffer),
        '00-input-grid.png',
        `📥 INPUT GRID (${batch.map((c) => c.person.personSlug).join(', ')})`,
      );

      // Call OpenRouter
      const apiKey = process.env.OPEN_ROUTER_API_KEY;
      log('OpenRouter API key', { configured: Boolean(apiKey && apiKey.length > 0) });
      if (!apiKey) {
        throw new Error('OPEN_ROUTER_API_KEY environment variable is not set.');
      }

      const client = new OpenAI({
        apiKey,
        baseURL: 'https://openrouter.ai/api/v1',
      });

      log('calling OpenRouter chat.completions…', { model: 'google/gemini-3.1-flash-image-preview' });
      let aiResponse: OpenAI.Chat.Completions.ChatCompletion;
      try {
        aiResponse = await client.chat.completions.create({
          model: 'google/gemini-3.1-flash-image-preview',
          messages: [
            {
              role: 'user',
              content: [
                {
                  type: 'image_url',
                  image_url: { url: `data:image/png;base64,${gridBase64}` },
                },
                {
                  type: 'text',
                  text: `Render each photo as a black-and-white hand-stippled portraits rendered in a style that looks like pen-and-ink dot work. Remove the background. Add slight dotted texture around the person. Return the result as a single image maintaining the EXACT SAME 3x3 grid layout and positions.

                  Important: DO NOT include grid lines or borders anywhere in the image.

                  important: image color temperature should be set to 6500k with black ink on a PURE WHITE #FFFFFFF background. DO NOT USE ANY OTHER COLORS.

                  If a portrait is not supplied - but instead a graphic or logo — apply the effect to the provided image or generate a styled questionmark. DO NOT HALUCINATE A PORTRAIT of the person. .`,
                },
              ],
            },
          ],
          modalities: ['image', 'text'],
          image_config: { aspect_ratio: '1:1' },
        } as OpenAI.Chat.Completions.ChatCompletionCreateParamsNonStreaming);
      } catch (apiErr) {
        log('OpenRouter API error', apiErr);
        throw apiErr;
      }

      const choice0 = aiResponse.choices[0];
      log('OpenRouter response', {
        id: aiResponse.id,
        model: aiResponse.model,
        choices: aiResponse.choices.length,
        finishReason: choice0?.finish_reason,
        messageRole: choice0?.message?.role,
      });

      // Log reasoning if present (Gemini sometimes returns reasoning instead of an image)
      const reasoning = (choice0?.message as Record<string, unknown>)?.reasoning;
      if (reasoning) {
        log('model reasoning', reasoning);
      }

      const resultImage = extractImageFromResponse(aiResponse, log);
      if (!resultImage) {
        throw new Error('No image returned from AI model (see server logs for response shape).');
      }
      log('decoded result image from model', { base64Chars: resultImage.length });

      let resultImg: Awaited<ReturnType<typeof Jimp.fromBuffer>>;
      try {
        resultImg = await Jimp.fromBuffer(Buffer.from(resultImage, 'base64'));
      } catch (jimpErr) {
        log('Jimp failed to parse model image bytes', jimpErr);
        throw new Error(
          `Model returned data that is not a valid image: ${jimpErr instanceof Error ? jimpErr.message : String(jimpErr)}`,
        );
      }
      log('result image dimensions', { width: resultImg.width, height: resultImg.height });

      const resultPngBuf = await resultImg.getBuffer('image/png');
      await debugImage(Buffer.from(resultPngBuf), '01-ai-output-grid.png', '📤 AI OUTPUT GRID');

      if (resultImg.width !== GRID_PIXELS || resultImg.height !== GRID_PIXELS) {
        log('resizing model output to 1024×1024 before slicing', {
          from: { w: resultImg.width, h: resultImg.height },
        });
        resultImg.resize({ w: GRID_PIXELS, h: GRID_PIXELS });
      }

      log('uploading cells to R2 (completed only after each put succeeds)…');
      let uploaded = 0;
      let uploadFailed = 0;

      for (let i = 0; i < batch.length; i++) {
        const slug = batch[i].person.personSlug;
        const { x, y, w, h } = cellBoundsInset(i);
        const cell = resultImg.clone().crop({ x, y, w, h });
        cell.resize({ w: EXPORT_AVATAR_PX, h: EXPORT_AVATAR_PX });
        const cellBuffer = await cell.getBuffer('image/png');
        await debugImage(Buffer.from(cellBuffer), `02-cell-${i}-${slug}.png`, `🔪 CELL ${i} → ${slug}`);

        try {
          const ab = new Uint8Array(cellBuffer).buffer as ArrayBuffer;
          await avatarsBucket.put(`${slug}.png`, ab, {
            httpMetadata: { contentType: 'image/png' },
          });
          await context.db
            .update(schema.generatedAvatars)
            .set({
              status: 'completed',
              generatedAt: new Date().toISOString(),
              error: null,
            })
            .where(eq(schema.generatedAvatars.personSlug, slug))
            .run();
          uploaded++;
        } catch (err) {
          console.log(`[avatars] R2 upload failed for ${slug}:`, err);
          const uploadErr = err instanceof Error ? err.message : String(err);
          await context.db
            .update(schema.generatedAvatars)
            .set({
              status: 'failed',
              error: `R2 upload failed: ${uploadErr}`,
            })
            .where(eq(schema.generatedAvatars.personSlug, slug))
            .run();
          uploadFailed++;
        }
      }

      log('batch upload done', { uploaded, uploadFailed, batchId });
      const msg =
        uploadFailed === 0
          ? `Saved ${uploaded} stippled avatar(s) to R2.`
          : uploaded > 0
            ? `Saved ${uploaded} to R2; ${uploadFailed} row(s) failed. Use Regenerate failed for R2 errors.`
            : `All ${uploadFailed} row(s) failed.`;
      return {
        batchId,
        processed: uploaded,
        message: msg,
      };
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Unknown error';
      console.log('[avatars.generateBatch] FAILED — marking batch as failed:', errorMsg);
      if (err instanceof Error && err.stack) console.log('[avatars.generateBatch] stack:', err.stack);
      for (const { person } of batch) {
        await context.db
          .update(schema.generatedAvatars)
          .set({ status: 'failed', error: errorMsg })
          .where(eq(schema.generatedAvatars.personSlug, person.personSlug))
          .run();
      }
      throw err;
    }
  },
});

// ── avatars.retryFailed ────────────────────────────────────────────

const retryFailedInputSchema = z.object({});

const retryFailedTool = defineTool({
  name: 'avatars.retryFailed',
  scope: 'avatars',
  description: 'Reset all failed and skipped_no_source avatar rows back to pending so they can be retried.',
  inputSchema: retryFailedInputSchema,
  async handler(context) {
    const retryableRows = await context.db
      .select({ personSlug: schema.generatedAvatars.personSlug })
      .from(schema.generatedAvatars)
      .where(inArray(schema.generatedAvatars.status, ['failed', 'skipped_no_source']))
      .all();

    for (const row of retryableRows) {
      await context.db
        .update(schema.generatedAvatars)
        .set({ status: 'pending', error: null })
        .where(eq(schema.generatedAvatars.personSlug, row.personSlug))
        .run();
    }

    return { reset: retryableRows.length };
  },
});

// ── avatars.clearFailed ─────────────────────────────────────────────

const clearFailedInputSchema = z.object({});

const clearFailedTool = defineTool({
  name: 'avatars.clearFailed',
  scope: 'avatars',
  description:
    'Delete all failed and skipped_no_source avatar rows so those people show as not started (none).',
  inputSchema: clearFailedInputSchema,
  async handler(context) {
    const removableRows = await context.db
      .select({ personSlug: schema.generatedAvatars.personSlug })
      .from(schema.generatedAvatars)
      .where(inArray(schema.generatedAvatars.status, ['failed', 'skipped_no_source']))
      .all();

    if (removableRows.length === 0) {
      return { deleted: 0, message: 'No failed/skipped rows to remove.' };
    }

    await context.db
      .delete(schema.generatedAvatars)
      .where(inArray(schema.generatedAvatars.status, ['failed', 'skipped_no_source']))
      .run();

    return {
      deleted: removableRows.length,
      message: `Removed ${removableRows.length} failed/skipped record(s). Those people are back to “not started”.`,
    };
  },
});

// ── avatars.flagMissingFromR2 ─────────────────────────────────────

const flagMissingFromR2InputSchema = z.object({});

const flagMissingFromR2Tool = defineTool({
  name: 'avatars.flagMissingFromR2',
  scope: 'avatars',
  description:
    'For each row marked completed, check R2 for the PNG. If missing, mark failed so you can regenerate (fixes old “completed” rows saved before R2 worked).',
  inputSchema: flagMissingFromR2InputSchema,
  async handler(context) {
    const bucket = resolveAvatarsBucket();
    if (!bucket) {
      return {
        flagged: 0,
        message: 'R2 bucket not available — run with wrangler / deployed worker.',
      };
    }

    const completed = await context.db
      .select({ personSlug: schema.generatedAvatars.personSlug })
      .from(schema.generatedAvatars)
      .where(eq(schema.generatedAvatars.status, 'completed'))
      .all();

    let flagged = 0;
    const key = (slug: string) => `${slug}.png`;

    for (const row of completed) {
      let exists = false;
      try {
        if (typeof bucket.head === 'function') {
          exists = (await bucket.head(key(row.personSlug))) != null;
        } else {
          exists = (await bucket.get(key(row.personSlug))) != null;
        }
      } catch (err) {
        console.log('[avatars.flagMissingFromR2] error checking', row.personSlug, err);
        exists = false;
      }

      if (!exists) {
        await context.db
          .update(schema.generatedAvatars)
          .set({
            status: 'failed',
            error:
              'Was marked completed but no PNG in R2. Regenerate (storage is fixed).',
            generatedAt: null,
          })
          .where(eq(schema.generatedAvatars.personSlug, row.personSlug))
          .run();
        flagged++;
      }
    }

    return {
      flagged,
      message:
        flagged > 0
          ? `Flagged ${flagged} row(s) as failed (no file in R2). Use “Regenerate failed”.`
          : 'Every completed row has a matching file in R2.',
    };
  },
});

// ── Helpers ────────────────────────────────────────────────────────

function summarizeContentForLog(content: unknown): unknown {
  if (content == null) return null;
  if (typeof content === 'string') {
    const preview = content.slice(0, 200);
    const hasDataUri = /data:image\//.test(content);
    return { kind: 'string', length: content.length, preview, hasDataUri };
  }
  if (!Array.isArray(content)) return { kind: typeof content };
  return (content as Array<Record<string, unknown>>).map((part) => {
    const type = part.type;
    if (type === 'image_url' && part.image_url && typeof part.image_url === 'object') {
      const url = String((part.image_url as { url?: string }).url ?? '');
      return {
        type: 'image_url',
        urlPrefix: url.slice(0, 40),
        isDataUri: url.startsWith('data:'),
      };
    }
    if (type === 'text' && typeof part.text === 'string') {
      return { type: 'text', length: part.text.length };
    }
    return { type, keys: Object.keys(part) };
  });
}

/** OpenRouter puts generated images here for Gemini image models (content is often null). */
function extractBase64FromOpenRouterMessageImages(message: unknown): string | null {
  if (!message || typeof message !== 'object') return null;
  const images = (message as { images?: unknown }).images;
  if (!Array.isArray(images)) return null;
  for (const item of images) {
    if (!item || typeof item !== 'object') continue;
    const rec = item as Record<string, unknown>;
    if (rec.type === 'image_url' && rec.image_url && typeof rec.image_url === 'object') {
      const url = String((rec.image_url as { url?: string }).url ?? '');
      const m = url.match(/data:image\/[^;]+;base64,(.+)/);
      if (m?.[1]) return m[1];
    }
  }
  return null;
}

function extractImageFromResponse(
  response: OpenAI.Chat.Completions.ChatCompletion,
  log?: (msg: string, extra?: unknown) => void,
): string | null {
  for (let ci = 0; ci < response.choices.length; ci++) {
    const choice = response.choices[ci];
    const msg = choice.message;

    const fromImages = extractBase64FromOpenRouterMessageImages(msg);
    if (fromImages) {
      log?.(`choice[${ci}] image from message.images`);
      return fromImages;
    }

    const content = msg?.content;
    if (!content) {
      log?.(`choice[${ci}] has no message.content and no message.images`, {
        messageKeys: msg && typeof msg === 'object' ? Object.keys(msg) : [],
      });
      continue;
    }

    // If content is a string, check for inline base64 data URI
    if (typeof content === 'string') {
      const match = content.match(/data:image\/[^;]+;base64,([A-Za-z0-9+/=]+)/);
      if (match) return match[1];
    }

    // Content parts array (multimodal response)
    if (Array.isArray(content)) {
      for (const part of content as Array<Record<string, unknown>>) {
        if (part.type === 'image_url' && typeof part.image_url === 'object' && part.image_url !== null) {
          const url = (part.image_url as { url?: string }).url ?? '';
          const b64Match = url.match(/data:image\/[^;]+;base64,(.+)/);
          if (b64Match) return b64Match[1];
        }
        // Gemini-style inline_data
        if (part.type === 'image' && typeof part.source === 'object' && part.source !== null) {
          const source = part.source as { data?: string };
          if (source.data) return source.data;
        }
        // Direct inline_data from Gemini via OpenRouter
        if (typeof part.inline_data === 'object' && part.inline_data !== null) {
          const inlineData = part.inline_data as { data?: string };
          if (inlineData.data) return inlineData.data;
        }
      }
    }
  }

  const first = response.choices[0];
  log?.('could not extract image; first choice summary', {
    content: summarizeContentForLog(first?.message?.content),
    messageKeys: first?.message && typeof first.message === 'object' ? Object.keys(first.message) : [],
  });
  return null;
}

// ── avatars.markPersonFailed ───────────────────────────────────────

const markPersonFailedInputSchema = z.object({
  personSlug: z.string().min(1),
});

const markPersonFailedTool = defineTool({
  name: 'avatars.markPersonFailed',
  scope: 'avatars',
  description:
    'Mark one person’s avatar row as failed so they are included in “Regenerate failed”. Use to redo a single bad stipple.',
  inputSchema: markPersonFailedInputSchema,
  async handler(context, input) {
    const people = getAllPeople();
    const person = people.find((p) => p.personSlug === input.personSlug);
    if (!person) {
      throw new Error(`Unknown personSlug: ${input.personSlug}`);
    }

    await context.db
      .insert(schema.generatedAvatars)
      .values({
        personSlug: input.personSlug,
        status: 'failed',
        error: 'Marked for regeneration from admin.',
        batchId: null,
        gridPosition: null,
        generatedAt: null,
      })
      .onConflictDoUpdate({
        target: schema.generatedAvatars.personSlug,
        set: {
          status: 'failed',
          error: 'Marked for regeneration from admin.',
          batchId: null,
          gridPosition: null,
          generatedAt: null,
        },
      })
      .run();

    const bucket = resolveAvatarsBucket();
    if (bucket) {
      try {
        await bucket.delete(`${input.personSlug}.png`);
      } catch (err) {
        console.log(`[avatars.markPersonFailed] R2 delete failed for ${input.personSlug}:`, err);
      }
    }

    return {
      personSlug: input.personSlug,
      name: person.name,
      message: `${person.name} is now failed — use “Regenerate failed (9)” to redo.`,
    };
  },
});

// ── avatars.markPendingFailed ──────────────────────────────────────

const markPendingFailedInputSchema = z.object({});

const markPendingFailedTool = defineTool({
  name: 'avatars.markPendingFailed',
  scope: 'avatars',
  description: 'Mark all pending (not-yet-started) avatar rows as failed so they can be regenerated.',
  inputSchema: markPendingFailedInputSchema,
  async handler(context) {
    const pendingRows = await context.db
      .select({ personSlug: schema.generatedAvatars.personSlug })
      .from(schema.generatedAvatars)
      .where(eq(schema.generatedAvatars.status, 'pending'))
      .all();

    if (pendingRows.length === 0) {
      return { updated: 0, message: 'No pending rows to mark.' };
    }

    for (const row of pendingRows) {
      await context.db
        .update(schema.generatedAvatars)
        .set({ status: 'failed', error: 'Bulk-marked from pending via admin.' })
        .where(eq(schema.generatedAvatars.personSlug, row.personSlug))
        .run();
    }

    return {
      updated: pendingRows.length,
      message: `Marked ${pendingRows.length} pending row(s) as failed.`,
    };
  },
});

// ── Export ──────────────────────────────────────────────────────────

export const avatarTools: ToolDefinition[] = [
  getStatusTool,
  generateBatchTool,
  retryFailedTool,
  clearFailedTool,
  flagMissingFromR2Tool,
  markPersonFailedTool,
  markPendingFailedTool,
];
