import { vi } from 'vitest';

vi.mock('cloudflare:workers', () => ({
  env: {} as Record<string, unknown>,
}));
