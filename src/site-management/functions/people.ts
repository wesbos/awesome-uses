import { z } from 'zod';
import { defineTool } from '../registry';
import type { ToolDefinition } from '../types';
import { NotFoundError } from '../errors';
import { maybeArraySchema, optionalTrimmedStringSchema, paginationSchema, slugSchema } from '../schemas';
import type { PersonRecord } from '../../lib/types';

const personRecordSchema = z.object({
  name: z.string().trim().min(1),
  github: optionalTrimmedStringSchema,
  description: z.string().trim().min(1),
  url: z.string().trim().url(),
  country: z.string().trim().min(1),
  twitter: optionalTrimmedStringSchema,
  mastodon: optionalTrimmedStringSchema,
  bluesky: optionalTrimmedStringSchema,
  emoji: optionalTrimmedStringSchema,
  computer: z.enum(['apple', 'windows', 'linux', 'bsd']).optional(),
  phone: z.enum(['iphone', 'android', 'windowsphone', 'flipphone']).optional(),
  tags: maybeArraySchema,
});

const personPatchSchema = personRecordSchema.partial().extend({
  tags: z.array(z.string().trim().min(1)).optional(),
});

const listPeopleInputSchema = paginationSchema.extend({
  q: optionalTrimmedStringSchema,
});

const getPeopleInputSchema = z.object({
  personSlug: slugSchema,
});

const createPeopleInputSchema = z.object({
  person: personRecordSchema,
  index: z.number().int().min(0).optional(),
});

const updatePeopleInputSchema = z.object({
  personSlug: slugSchema,
  patch: personPatchSchema,
});

const deletePeopleInputSchema = z.object({
  personSlug: slugSchema,
});

const syncPeopleInputSchema = z.object({});

function toPersonRecord(input: z.infer<typeof personRecordSchema>): PersonRecord {
  return {
    name: input.name,
    description: input.description,
    url: input.url,
    country: input.country,
    tags: input.tags,
    ...(input.github ? { github: input.github } : {}),
    ...(input.twitter ? { twitter: input.twitter } : {}),
    ...(input.mastodon ? { mastodon: input.mastodon } : {}),
    ...(input.bluesky ? { bluesky: input.bluesky } : {}),
    ...(input.emoji ? { emoji: input.emoji } : {}),
    ...(input.computer ? { computer: input.computer } : {}),
    ...(input.phone ? { phone: input.phone } : {}),
  };
}

function applyPatch(record: PersonRecord, patch: z.infer<typeof personPatchSchema>): PersonRecord {
  return {
    ...record,
    ...patch,
    tags: patch.tags ?? record.tags,
  };
}

export const peopleTools: ToolDefinition[] = [
  defineTool({
    name: 'people.list',
    scope: 'people',
    description: 'List people from source data file.',
    inputSchema: listPeopleInputSchema,
    handler: async ({ peopleStore }, input) => {
      const all = await peopleStore.listPeopleWithSlugs();
      const filtered = input.q
        ? all.filter((person) => {
            const search = `${person.name} ${person.description} ${person.url} ${person.tags.join(' ')}`.toLowerCase();
            return search.includes(input.q!.toLowerCase());
          })
        : all;
      const start = input.offset;
      const end = input.offset + input.limit;
      return {
        total: filtered.length,
        rows: filtered.slice(start, end),
      };
    },
  }),
  defineTool({
    name: 'people.get',
    scope: 'people',
    description: 'Get a person by slug.',
    inputSchema: getPeopleInputSchema,
    handler: async ({ peopleStore }, input) => {
      const rows = await peopleStore.listPeopleWithSlugs();
      const row = rows.find((person) => person.personSlug === input.personSlug);
      if (!row) throw new NotFoundError(`Person "${input.personSlug}" was not found.`);
      return row;
    },
  }),
  defineTool({
    name: 'people.create',
    scope: 'people',
    description: 'Create a person entry.',
    inputSchema: createPeopleInputSchema,
    handler: async ({ peopleStore }, input) => {
      const all = await peopleStore.loadPeople();
      const person = toPersonRecord(input.person);
      const index = typeof input.index === 'number' ? Math.min(input.index, all.length) : all.length;
      const next = [...all.slice(0, index), person, ...all.slice(index)];
      await peopleStore.writePeople(next);
      const withSlugs = peopleStore.withPersonSlugs(next);
      const created = withSlugs[index];
      return {
        created,
        total: next.length,
      };
    },
  }),
  defineTool({
    name: 'people.update',
    scope: 'people',
    description: 'Update a person by slug.',
    inputSchema: updatePeopleInputSchema,
    handler: async ({ peopleStore }, input) => {
      const all = await peopleStore.loadPeople();
      const withSlugs = peopleStore.withPersonSlugs(all);
      const index = withSlugs.findIndex((person) => person.personSlug === input.personSlug);
      if (index < 0) throw new NotFoundError(`Person "${input.personSlug}" was not found.`);
      const nextRecord = applyPatch(all[index], input.patch);
      const next = [...all];
      next[index] = nextRecord;
      await peopleStore.writePeople(next);
      const nextWithSlugs = peopleStore.withPersonSlugs(next);
      return {
        previousSlug: input.personSlug,
        updated: nextWithSlugs[index],
      };
    },
  }),
  defineTool({
    name: 'people.delete',
    scope: 'people',
    description: 'Delete a person by slug.',
    inputSchema: deletePeopleInputSchema,
    handler: async ({ peopleStore }, input) => {
      const all = await peopleStore.loadPeople();
      const withSlugs = peopleStore.withPersonSlugs(all);
      const index = withSlugs.findIndex((person) => person.personSlug === input.personSlug);
      if (index < 0) throw new NotFoundError(`Person "${input.personSlug}" was not found.`);
      const removed = withSlugs[index];
      const next = [...all.slice(0, index), ...all.slice(index + 1)];
      await peopleStore.writePeople(next);
      return {
        deleted: removed,
        total: next.length,
      };
    },
  }),
  defineTool({
    name: 'people.syncSnapshot',
    scope: 'people',
    description: 'Sync generated people snapshot from data file.',
    inputSchema: syncPeopleInputSchema,
    handler: async ({ peopleStore }) => {
      return peopleStore.syncSnapshotFromDataFile();
    },
  }),
];
