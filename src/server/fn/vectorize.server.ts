import type OpenAI from 'openai';
import { markVectorized } from '../db/index.server';
import { resolveVectorize } from '../db/vectorize.server';

const EMBEDDING_MODEL = 'text-embedding-3-small';

export async function vectorizeProfile(
  personSlug: string,
  contentMarkdown: string,
  itemNames: string[],
  openaiClient: OpenAI,
): Promise<void> {
  const vectorize = resolveVectorize();
  console.log(`[vectorize] ${personSlug}: binding=${!!vectorize}`);
  if (!vectorize) return;

  const parts = [`Profile: ${personSlug}`];
  if (itemNames.length > 0) {
    parts.push(`Tools and gear: ${itemNames.join(', ')}`);
  }
  parts.push(`Uses page content:\n${contentMarkdown.slice(0, 6000)}`);

  const input = parts.join('\n\n');
  console.log(`[vectorize] ${personSlug}: generating embedding (${input.length} chars)`);

  const response = await openaiClient.embeddings.create({
    model: EMBEDDING_MODEL,
    input,
    dimensions: 1536,
  });

  const values = response.data[0]?.embedding;
  console.log(`[vectorize] ${personSlug}: embedding dimensions=${values?.length ?? 0}`);
  if (!values?.length) return;

  const result = await vectorize.upsert([{
    id: personSlug,
    values,
    metadata: { personSlug },
  }]);
  console.log(`[vectorize] ${personSlug}: upsert result=`, JSON.stringify(result));
  await markVectorized(personSlug);
}
