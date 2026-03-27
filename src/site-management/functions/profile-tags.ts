import { z } from 'zod';
import { defineTool } from '../registry';
import type { ToolDefinition } from '../types';
import { getAllPeople } from './utils';

const listProfileTagsInputSchema = z.object({
  q: z.string().trim().optional(),
});

function collectProfileTagCounts(people: Array<{ tags: string[] }>): Array<{ tag: string; count: number }> {
  const counts = new Map<string, number>();
  for (const person of people) {
    for (const tag of person.tags) {
      const normalized = tag.trim();
      if (!normalized) continue;
      counts.set(normalized, (counts.get(normalized) || 0) + 1);
    }
  }
  return [...counts.entries()]
    .map(([tag, count]) => ({ tag, count }))
    .sort((a, b) => {
      if (b.count !== a.count) return b.count - a.count;
      return a.tag.localeCompare(b.tag);
    });
}

export const profileTagTools: ToolDefinition[] = [
  defineTool({
    name: 'profileTags.list',
    scope: 'profileTags',
    description: 'List profile tags from generated people data.',
    inputSchema: listProfileTagsInputSchema,
    handler: async (_context, input) => {
      const people = getAllPeople();
      const rows = collectProfileTagCounts(people);
      const filtered = input.q
        ? rows.filter((row) => row.tag.toLowerCase().includes(input.q!.toLowerCase()))
        : rows;
      return {
        total: filtered.length,
        rows: filtered,
      };
    },
  }),
];
