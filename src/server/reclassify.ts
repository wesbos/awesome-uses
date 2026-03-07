import { z } from 'zod';
import { zodResponseFormat } from 'openai/helpers/zod';
import { getExtractedCategories, getReclassifyCandidates } from './db/tags.server';
import { createOpenAIClient } from './extract';

const DEFAULT_MODEL = 'gpt-5-mini';

const DEFAULT_PROMPT = `You are reviewing extracted item tags from developer /uses pages.

For each item currently tagged as "{category}", decide:
1. Which category or categories it should belong to.
2. Whether it should remain in "{category}".
3. Whether a new category is needed (only if at least 3 items clearly need it).

Prefer existing categories whenever possible. Keep category names short and lowercase-hyphenated.`;

const ReclassifiedItemSchema = z.object({
  item: z.string(),
  categories: z.array(z.string()),
  reasoning: z.string(),
});

const ReclassifyOutputSchema = z.object({
  items: z.array(ReclassifiedItemSchema),
  newCategories: z.array(
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
  category: string;
  minUsers: number;
  limit: number;
  prompt?: string;
  model?: string;
};

export type ReclassifyPreviewResult = {
  category: string;
  minUsers: number;
  totalCandidates: number;
  candidates: Array<{ item: string; count: number }>;
  output: ReclassifyOutput;
};

export async function previewTagReclassification(
  input: ReclassifyPreviewInput,
): Promise<ReclassifyPreviewResult> {
  const category = input.category.trim();
  if (!category) {
    throw new Error('Category is required.');
  }

  const minUsers = Math.max(1, input.minUsers || 2);
  const limit = Math.max(1, Math.min(input.limit || 100, 500));
  const model = input.model?.trim() || DEFAULT_MODEL;

  const [candidates, allCategories] = await Promise.all([
    getReclassifyCandidates(category, minUsers, limit),
    getExtractedCategories(),
  ]);

  if (candidates.length === 0) {
    return {
      category,
      minUsers,
      totalCandidates: 0,
      candidates: [],
      output: { items: [], newCategories: [] },
    };
  }

  const client = createOpenAIClient();
  const systemPrompt = (input.prompt || DEFAULT_PROMPT).replaceAll('{category}', category);
  const itemList = candidates.map((entry) => `- ${entry.item}`).join('\n');

  const completion = await client.chat.completions.parse({
    model,
    messages: [
      { role: 'system', content: systemPrompt },
      {
        role: 'user',
        content: `Existing categories: ${allCategories.filter((entry) => entry !== category).join(', ')}

Items currently in "${category}" (${candidates.length}):
${itemList}

Rules:
- Prefer existing categories from the list above.
- Keep "${category}" only if still appropriate.
- You may assign multiple categories.
- New categories should only be proposed if at least 3 items clearly require one.`,
      },
    ],
    response_format: zodResponseFormat(ReclassifyOutputSchema, 'reclassification'),
  });

  const parsed = completion.choices[0]?.message?.parsed;
  if (!parsed) {
    throw new Error('Failed to parse reclassification response.');
  }

  return {
    category,
    minUsers,
    totalCandidates: candidates.length,
    candidates: candidates.map((candidate) => ({
      item: candidate.item,
      count: candidate.count,
    })),
    output: parsed,
  };
}
