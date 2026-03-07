#!/usr/bin/env tsx
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { createSiteManagementContext, executeTool, sortedTools, toolRegistry } from '../src/site-management';

async function main() {
  const context = createSiteManagementContext();
  const server = new McpServer({
    name: 'uses-site-management',
    version: '1.0.0',
  });

  for (const tool of sortedTools) {
    server.registerTool(
      tool.name,
      {
        description: tool.description,
        inputSchema: tool.inputSchema as any,
      },
      async (input) => {
        const result = await executeTool(toolRegistry, context, tool.name, input);
        const structuredContent =
          result.ok
            ? (typeof result.result === 'object' && result.result !== null
                ? (result.result as Record<string, unknown>)
                : { value: result.result })
            : {
                code: result.error.code,
                message: result.error.message,
                details: result.error.details ?? null,
              };
        if (!result.ok) {
          return {
            isError: true,
            content: [
              {
                type: 'text' as const,
                text: JSON.stringify(result, null, 2),
              },
            ],
            structuredContent,
          };
        }
        return {
          content: [
            {
              type: 'text' as const,
              text: JSON.stringify(result.result, null, 2),
            },
          ],
          structuredContent,
        };
      },
    );
  }

  const transport = new StdioServerTransport();
  await server.connect(transport);
  // MCP stdio servers should log to stderr only.
  console.error(`site-management MCP server ready with ${sortedTools.length} tools`);
}

void main();
