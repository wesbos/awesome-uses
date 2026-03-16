import { describe, expect, it } from 'vite-plus/test';
import { createSiteManagementFixture } from './test-utils';
import { handleMcpHttpRequest, handleSiteManagementApiRequest } from './http.server';

describe('site-management HTTP handlers', () => {
  it('lists tools and executes tools through REST handler', async () => {
    const fixture = await createSiteManagementFixture();
    process.env.SITE_REPO_ROOT = fixture.root;
    process.env.SITE_DB_PATH = fixture.dbPath;

    try {
      const listRes = await handleSiteManagementApiRequest(
        new Request('http://localhost/api/site-management', { method: 'GET' }),
      );
      expect(listRes.status).toBe(200);
      const listJson = (await listRes.json()) as { ok: boolean; tools: unknown[] };
      expect(listJson.ok).toBe(true);
      expect(listJson.tools.length).toBeGreaterThan(10);

      const callRes = await handleSiteManagementApiRequest(
        new Request('http://localhost/api/site-management', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            tool: 'people.list',
            input: { limit: 10, offset: 0 },
          }),
        }),
      );
      expect(callRes.status).toBe(200);
      const callJson = (await callRes.json()) as { ok: boolean; result: { rows: unknown[] } };
      expect(callJson.ok).toBe(true);
      expect(callJson.result.rows.length).toBeGreaterThan(0);
    } finally {
      delete process.env.SITE_REPO_ROOT;
      delete process.env.SITE_DB_PATH;
      await fixture.cleanup();
    }
  });

  it('supports initialize and tools/call through MCP HTTP handler', async () => {
    const fixture = await createSiteManagementFixture();
    process.env.SITE_REPO_ROOT = fixture.root;
    process.env.SITE_DB_PATH = fixture.dbPath;

    try {
      const initRes = await handleMcpHttpRequest(
        new Request('http://localhost/mcp', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            jsonrpc: '2.0',
            id: 1,
            method: 'initialize',
            params: {},
          }),
        }),
      );
      expect(initRes.status).toBe(200);
      const initJson = (await initRes.json()) as { result: { serverInfo: { name: string } } };
      expect(initJson.result.serverInfo.name).toBe('uses-site-management');

      const callRes = await handleMcpHttpRequest(
        new Request('http://localhost/mcp', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            jsonrpc: '2.0',
            id: 2,
            method: 'tools/call',
            params: {
              name: 'people.list',
              arguments: { limit: 5, offset: 0 },
            },
          }),
        }),
      );
      expect(callRes.status).toBe(200);
      const callJson = (await callRes.json()) as {
        result: { structuredContent: { rows: unknown[] } };
      };
      expect(callJson.result.structuredContent.rows.length).toBeGreaterThan(0);
    } finally {
      delete process.env.SITE_REPO_ROOT;
      delete process.env.SITE_DB_PATH;
      await fixture.cleanup();
    }
  });
});
