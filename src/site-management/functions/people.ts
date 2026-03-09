import { z } from 'zod';
import { asc } from 'drizzle-orm';
import * as schema from '../../server/schema';
import { defineTool } from '../registry';
import type { ToolDefinition } from '../types';
import { NotFoundError } from '../errors';
import { paginationSchema, optionalTrimmedStringSchema, slugSchema } from '../schemas';
import { getAllPeople, parseTagsJson } from './utils';

const listPeopleInputSchema = paginationSchema.extend({
  q: optionalTrimmedStringSchema,
  item: z.string().trim().optional().describe('Filter to people who use a specific item (exact item name).'),
  tag: z.string().trim().optional().describe('Filter to people who have items in a specific tag.'),
});

const getPeopleInputSchema = z.object({
  personSlug: slugSchema,
});

export const peopleTools: ToolDefinition[] = [
  defineTool({
    name: 'people.list',
    scope: 'people',
    description: 'List people from generated people data. Filter by text query, specific items they use, or tags their items belong to.',
    inputSchema: listPeopleInputSchema,
    handler: async ({ db }, input) => {
      let all = getAllPeople();

      if (input.q) {
        all = all.filter((person) => {
          const search = `${person.name} ${person.description} ${person.url} ${person.tags.join(' ')}`.toLowerCase();
          return search.includes(input.q!.toLowerCase());
        });
      }

      if (input.item || input.tag) {
        const rows = await db
          .select({
            personSlug: schema.personItems.personSlug,
            item: schema.personItems.item,
            tagsJson: schema.personItems.tagsJson,
          })
          .from(schema.personItems)
          .orderBy(asc(schema.personItems.item))
          .all();

        if (input.item) {
          const matchedSlugs = new Set(
            rows.filter((r) => r.item === input.item).map((r) => r.personSlug),
          );
          all = all.filter((p) => matchedSlugs.has(p.personSlug));
        }

        if (input.tag) {
          const matchedSlugs = new Set(
            rows
              .filter((r) => parseTagsJson(r.tagsJson).includes(input.tag!))
              .map((r) => r.personSlug),
          );
          all = all.filter((p) => matchedSlugs.has(p.personSlug));
        }
      }

      return {
        total: all.length,
        rows: all.slice(input.offset, input.offset + input.limit),
      };
    },
  }),
  defineTool({
    name: 'people.get',
    scope: 'people',
    description: 'Get a person by slug.',
    inputSchema: getPeopleInputSchema,
    handler: async (_context, input) => {
      const rows = getAllPeople();
      const row = rows.find((person) => person.personSlug === input.personSlug);
      if (!row) throw new NotFoundError(`Person "${input.personSlug}" was not found.`);
      return row;
    },
  }),
];
