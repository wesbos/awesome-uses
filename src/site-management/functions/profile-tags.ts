import { z } from 'zod';
import { defineTool } from '../registry';
import type { ToolDefinition } from '../types';
import { maybeArraySchema, nonEmptyStringSchema } from '../schemas';
import { uniqueSorted } from './utils';

const listProfileTagsInputSchema = z.object({
  q: z.string().trim().optional(),
});

const renameProfileTagInputSchema = z.object({
  fromTag: nonEmptyStringSchema,
  toTag: nonEmptyStringSchema,
});

const mergeProfileTagInputSchema = z.object({
  targetTag: nonEmptyStringSchema,
  sourceTags: z.array(nonEmptyStringSchema).min(1),
});

const deleteProfileTagInputSchema = z.object({
  tag: nonEmptyStringSchema,
  replacementTag: z.string().trim().optional(),
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
    description: 'List profile tags from source people data.',
    inputSchema: listProfileTagsInputSchema,
    handler: async ({ peopleStore }, input) => {
      const people = await peopleStore.loadPeople();
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
  defineTool({
    name: 'profileTags.rename',
    scope: 'profileTags',
    description: 'Rename a profile tag across all people entries.',
    inputSchema: renameProfileTagInputSchema,
    handler: async ({ peopleStore }, input) => {
      const fromKey = input.fromTag.trim().toLowerCase();
      const toTag = input.toTag.trim();
      const people = await peopleStore.loadPeople();

      let updatedPeople = 0;
      let updatedTagRefs = 0;
      const next = people.map((person) => {
        let touched = false;
        const tags = person.tags.map((tag) => {
          if (tag.trim().toLowerCase() === fromKey) {
            touched = true;
            updatedTagRefs += 1;
            return toTag;
          }
          return tag;
        });
        if (!touched) return person;
        updatedPeople += 1;
        return {
          ...person,
          tags: uniqueSorted(tags),
        };
      });

      await peopleStore.writePeople(next);
      return {
        fromTag: input.fromTag,
        toTag,
        updatedPeople,
        updatedTagRefs,
      };
    },
  }),
  defineTool({
    name: 'profileTags.merge',
    scope: 'profileTags',
    description: 'Merge source profile tags into one target tag.',
    inputSchema: mergeProfileTagInputSchema,
    handler: async ({ peopleStore }, input) => {
      const sourceSet = new Set(input.sourceTags.map((entry) => entry.trim().toLowerCase()));
      const targetTag = input.targetTag.trim();
      sourceSet.delete(targetTag.toLowerCase());

      const people = await peopleStore.loadPeople();
      let updatedPeople = 0;
      let mergedRefs = 0;

      const next = people.map((person) => {
        let touched = false;
        const tags = person.tags.map((tag) => {
          const normalized = tag.trim().toLowerCase();
          if (sourceSet.has(normalized)) {
            touched = true;
            mergedRefs += 1;
            return targetTag;
          }
          return tag;
        });
        if (!touched) return person;
        updatedPeople += 1;
        return {
          ...person,
          tags: uniqueSorted(tags),
        };
      });

      await peopleStore.writePeople(next);
      return {
        targetTag,
        sourceTags: [...sourceSet],
        updatedPeople,
        mergedRefs,
      };
    },
  }),
  defineTool({
    name: 'profileTags.delete',
    scope: 'profileTags',
    description: 'Delete a profile tag, optionally replacing with another.',
    inputSchema: deleteProfileTagInputSchema,
    handler: async ({ peopleStore }, input) => {
      const deleteKey = input.tag.trim().toLowerCase();
      const replacementTag = input.replacementTag?.trim();
      const people = await peopleStore.loadPeople();

      let updatedPeople = 0;
      let removedRefs = 0;
      const next = people.map((person) => {
        let touched = false;
        const tags = person.tags
          .flatMap((tag) => {
            const normalized = tag.trim().toLowerCase();
            if (normalized !== deleteKey) return [tag];
            touched = true;
            removedRefs += 1;
            if (replacementTag) return [replacementTag];
            return [];
          });
        if (!touched) return person;
        updatedPeople += 1;
        return {
          ...person,
          tags: uniqueSorted(tags),
        };
      });

      await peopleStore.writePeople(next);
      return {
        deletedTag: input.tag,
        replacementTag: replacementTag ?? null,
        updatedPeople,
        removedRefs,
      };
    },
  }),
];
