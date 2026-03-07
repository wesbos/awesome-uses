import { describe, expect, it } from 'vitest';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { createSiteManagementFixture } from '../src/site-management/test-utils';

describe('site-management MCP', () => {
  it(
    'registers tools and dispatches tool calls',
    async () => {
      const fixture = await createSiteManagementFixture();
      const env = {
        ...process.env,
        SITE_REPO_ROOT: fixture.root,
        SITE_DATA_FILE_PATH: fixture.dataFilePath,
        SITE_GENERATED_PEOPLE_PATH: fixture.generatedPeoplePath,
        SITE_DB_PATH: fixture.dbPath,
      } as Record<string, string>;

      const transport = new StdioClientTransport({
        command: 'pnpm',
        args: ['tsx', './scripts/site-management-mcp.ts'],
        cwd: '/workspace',
        env,
        stderr: 'pipe',
      });
      const client = new Client({
        name: 'site-management-test-client',
        version: '1.0.0',
      });

      try {
        await client.connect(transport);
        const tools = await client.listTools();
        expect(tools.tools.length).toBeGreaterThan(10);
        expect(tools.tools.some((tool) => tool.name === 'people.list')).toBe(true);

        const result = await client.callTool({
          name: 'people.list',
          arguments: { limit: 5, offset: 0 },
        });
        if ('structuredContent' in result && result.structuredContent) {
          expect(result.structuredContent).toHaveProperty('rows');
        } else {
          throw new Error('Expected structuredContent in MCP tool response.');
        }
      } finally {
        await transport.close();
        fixture.context.siteDb.close();
        await fixture.cleanup();
      }
    },
    20000,
  );
});
