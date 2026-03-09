import { z } from 'zod';

export const slugSchema = z
  .string()
  .trim()
  .min(1)
  .max(120)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Must be a kebab-case slug.');

export const nonEmptyStringSchema = z.string().trim().min(1);

export const optionalTrimmedStringSchema = z
  .string()
  .trim()
  .optional()
  .transform((value) => (value && value.length > 0 ? value : undefined));

export const isoDatetimeSchema = z
  .string()
  .datetime()
  .or(z.string().refine((value) => !Number.isNaN(Date.parse(value)), 'Invalid datetime.'));

export const paginationSchema = z.object({
  limit: z.number().int().positive().max(100).default(10),
  offset: z.number().int().min(0).default(0),
});

export const maybeArraySchema = z.array(z.string().trim().min(1)).default([]);
