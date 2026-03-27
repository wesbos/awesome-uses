import { vi } from 'vite-plus/test';

vi.mock('cloudflare:workers', () => ({
  env: {} as Record<string, unknown>,
}));
