import { z } from 'zod';
import type { Device, DirectoryFilters } from './types';

const DEVICE_VALUES = ['apple', 'windows', 'linux', 'bsd', 'iphone', 'android', 'windowsphone', 'flipphone'] as const;

const filterSearchSchema = z.object({
  tag: z
    .string()
    .trim()
    .max(96)
    .optional()
    .transform((value) => (value ? value : undefined)),
  country: z
    .string()
    .trim()
    .max(8)
    .optional()
    .transform((value) => (value ? value : undefined)),
  device: z
    .enum(DEVICE_VALUES)
    .optional()
    .transform((value) => (value ? (value as Device) : undefined)),
  q: z
    .string()
    .trim()
    .max(120)
    .optional()
    .transform((value) => (value ? value : undefined)),
});

export function parseDirectorySearch(input: unknown): DirectoryFilters {
  const parsed = filterSearchSchema.parse(input ?? {});
  return {
    tag: parsed.tag,
    country: parsed.country,
    device: parsed.device,
    q: parsed.q,
  };
}

export function normalizeFilters(filters: DirectoryFilters): DirectoryFilters {
  return {
    tag: filters.tag || undefined,
    country: filters.country || undefined,
    device: filters.device || undefined,
    q: filters.q?.trim() || undefined,
  };
}
