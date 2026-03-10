import { z } from 'zod';
import { zodResponseFormat } from 'openai/helpers/zod';
import { getExtractedTags, getReclassifyCandidates } from './db/tags.server';
import { createOpenAIClient } from './extract';

const DEFAULT_MODEL = 'gpt-5-mini';

const DEFAULT_PROMPT = `You are reviewing extracted item tags from developer /uses pages.

For each item currently tagged as "{tag}", decide:
1. Which tag or tags it should belong to.
2. Whether it should remain in "{tag}".
3. Whether a new tag is needed (only if at least 3 items clearly need it).

Prefer existing tags whenever possible. Keep tag names short and lowercase-hyphenated.`;

const ReclassifiedItemSchema = z.object({
  item: z.string(),
  tags: z.array(z.string()),
  reasoning: z.string(),
});

const ReclassifyOutputSchema = z.object({
  items: z.array(ReclassifiedItemSchema),
  newTags: z.array(
    z.object({
      name: z.string(),
      description: z.string(),
      examples: z.array(z.string()),
    })
  ),
});

export type ReclassifiedItem = z.infer<typeof ReclassifiedItemSchema>;
export type ReclassifyOutput = z.infer<typeof ReclassifyOutputSchema>;

export type ReclassifyPreviewInput = {
  tag: string;
  minUsers: number;
  limit: number;
  prompt?: string;
  model?: string;
};

export type ReclassifyPreviewResult = {
  tag: string;
  minUsers: number;
  totalCandidates: number;
  candidates: Array<{ item: string; count: number }>;
  output: ReclassifyOutput;
};

export async function previewTagReclassification(
  input: ReclassifyPreviewInput,
): Promise<ReclassifyPreviewResult> {
  const tag = input.tag.trim();
  if (!tag) {
    throw new Error('Tag is required.');
  }

  const minUsers = Math.max(1, input.minUsers || 2);
  const limit = Math.max(1, Math.min(input.limit || 100, 500));
  const model = input.model?.trim() || DEFAULT_MODEL;

  const [candidates, allTags] = await Promise.all([
    getReclassifyCandidates(tag, minUsers, limit),
    getExtractedTags(),
  ]);

  if (candidates.length === 0) {
    return {
      tag,
      minUsers,
      totalCandidates: 0,
      candidates: [],
      output: { items: [], newTags: [] },
    };
  }

  const client = createOpenAIClient();
  const systemPrompt = (input.prompt || DEFAULT_PROMPT).replaceAll('{tag}', tag);
  const itemList = candidates.map((entry) => `- ${entry.item}`).join('\n');

  const completion = await client.chat.completions.parse({
    model,
    messages: [
      { role: 'system', content: systemPrompt },
      {
        role: 'user',
        content: `Existing tags: ${allTags.filter((entry) => entry !== tag).join(', ')}

Items currently in "${tag}" (${candidates.length}):
${itemList}

Rules:
- Prefer existing tags from the list above.
- Keep "${tag}" only if still appropriate.
- You may assign multiple tags.
- New tags should only be proposed if at least 3 items clearly require one.`,
      },
    ],
    response_format: zodResponseFormat(ReclassifyOutputSchema, 'reclassification'),
  });

  const parsed = completion.choices[0]?.message?.parsed;
  if (!parsed) {
    throw new Error('Failed to parse reclassification response.');
  }

  return {
    tag,
    minUsers,
    totalCandidates: candidates.length,
    candidates: candidates.map((candidate) => ({
      item: candidate.item,
      count: candidate.count,
    })),
    output: parsed,
  };
}
