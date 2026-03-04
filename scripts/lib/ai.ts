import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import OpenAI from 'openai';
import { z } from 'zod';
import { zodResponseFormat } from 'openai/helpers/zod';

export const ExtractedItem = z.object({
  item: z.string().describe('Product or tool name, e.g. "LG 27UK850" or "VS Code"'),
  tags: z.array(z.string()).describe('Lowercase descriptive labels, e.g. ["monitor", "keyboard", "editor", "terminal"]'),
  detail: z.string().nullable().describe('Brief extra context from the page, e.g. "27 inch, USB-C"'),
});

export const ExtractionResult = z.object({
  items: z.array(ExtractedItem),
});

export type ExtractedItemType = z.infer<typeof ExtractedItem>;
export type ExtractionResultType = z.infer<typeof ExtractionResult>;

const SYSTEM_PROMPT = `You extract tools, products, and gear from developer /uses pages.

For each distinct item mentioned, return:
- item: the product/tool name (be specific — include model numbers when given)
- tags: lowercase labels that describe what the item is and does. Use multiple tags.
  Examples:
    LG 27UK850 → ["monitor", "display", "4k", "usb-c"]
    Keychron K2 → ["keyboard", "mechanical", "wireless"]
    VS Code → ["editor", "ide"]
    iTerm2 → ["terminal", "shell"]
    GitHub → ["git", "hosting", "service"]
    Cobalt2 → ["theme", "config"]
    Monitor arm → ["stand", "mount", "accessory"]
- detail: brief context from the page (size, color, specific model info), or null

Rules:
- Only extract items the author actually uses, not items they mention in passing or recommend against.
- Normalize product names (e.g. "Visual Studio Code" → "VS Code", "MacBook Pro 16"" → "MacBook Pro 16-inch").
- If the page has no extractable items, return an empty items array.
- Keep tags short and reusable across pages. Prefer common terms.`;

function loadCanonicalTags(): string[] | null {
  const tagsPath = path.resolve(process.cwd(), 'src/generated/item-tags.json');
  if (!existsSync(tagsPath)) return null;
  try {
    const data = JSON.parse(readFileSync(tagsPath, 'utf8'));
    return Array.isArray(data.tags) ? data.tags : null;
  } catch {
    return null;
  }
}

function buildSystemPrompt(): string {
  const canonicalTags = loadCanonicalTags();
  if (!canonicalTags) return SYSTEM_PROMPT;

  return `${SYSTEM_PROMPT}

IMPORTANT: Use ONLY tags from this canonical list: ${JSON.stringify(canonicalTags)}
If none of the canonical tags fit an item, use the closest match. Do not invent new tags.`;
}

export const DEFAULT_MODEL = 'gpt-5-mini';

export function createOpenAIClient(): OpenAI {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY environment variable is required');
  }
  return new OpenAI({ apiKey });
}

export async function extractItemsFromMarkdown(
  client: OpenAI,
  markdown: string,
  model = DEFAULT_MODEL
): Promise<ExtractionResultType> {
  const trimmed = markdown.slice(0, 15_000);

  const completion = await client.chat.completions.parse({
    model,
    messages: [
      { role: 'system', content: buildSystemPrompt() },
      { role: 'user', content: trimmed },
    ],
    response_format: zodResponseFormat(ExtractionResult, 'extraction'),
  });

  const parsed = completion.choices[0]?.message.parsed;
  if (!parsed) {
    return { items: [] };
  }
  return parsed;
}
