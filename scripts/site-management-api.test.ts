import { spawn } from 'node:child_process';
import { setTimeout as delay } from 'node:timers/promises';
import { describe, expect, it } from 'vitest';
import { createSiteManagementFixture } from '../src/site-management/test-utils';

async function waitForHealth(url: string, attempts = 30): Promise<void> {
  for (let index = 0; index < attempts; index += 1) {
    try {
      const res = await fetch(`${url}/health`);
      if (res.ok) return;
    } catch {
      // ignore
    }
    await delay(200);
  }
  throw new Error('API server did not become healthy in time.');
}

describe('site-management API', () => {
  it('serves tool metadata and executes tool calls', async () => {
    const fixture = await createSiteManagementFixture();
    const port = 8799;
    const baseUrl = `http://127.0.0.1:${port}`;
    const env = {
      ...process.env,
      SITE_REPO_ROOT: fixture.root,
      SITE_DATA_FILE_PATH: fixture.dataFilePath,
      SITE_GENERATED_PEOPLE_PATH: fixture.generatedPeoplePath,
      SITE_DB_PATH: fixture.dbPath,
      SITE_MANAGEMENT_API_PORT: String(port),
    };

    const child = spawn(
      'pnpm',
      ['tsx', './scripts/site-management-api.ts', '--port', String(port)],
      {
        cwd: '/workspace',
        env,
        stdio: ['ignore', 'pipe', 'pipe'],
      },
    );

    try {
      await waitForHealth(baseUrl);

      const toolsRes = await fetch(`${baseUrl}/tools`);
      expect(toolsRes.ok).toBe(true);
      const toolsJson = (await toolsRes.json()) as { ok: boolean; total: number };
      expect(toolsJson.ok).toBe(true);
      expect(toolsJson.total).toBeGreaterThan(10);

      const callRes = await fetch(`${baseUrl}/tools/people.list`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ input: { limit: 10, offset: 0 } }),
      });
      expect(callRes.ok).toBe(true);
      const callJson = (await callRes.json()) as { ok: boolean };
      expect(callJson.ok).toBe(true);
    } finally {
      if (child.pid) {
        process.kill(child.pid, 'SIGTERM');
      }
      await fixture.cleanup();
    }
  }, 20000);
});
