import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { WebStandardStreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js';
import { createSiteManagementContext } from './context';
import { resolveDb } from '../server/db/connection.server';
import { executeTool } from './executor';
import { sortedTools, toolRegistry } from './tools';
import type { SiteDb } from './stores/site-db';

function createMcpServer(): McpServer {
  const mcp = new McpServer(
    { name: 'uses-site-management', version: '1.0.0' },
    { capabilities: { tools: { listChanged: false } } },
  );

  const d1 = resolveDb();
  const context = d1
    ? createSiteManagementContext({ db: d1 as unknown as SiteDb })
    : createSiteManagementContext();

  for (const tool of sortedTools) {
    mcp.registerTool(tool.name, {
      description: tool.description,
      inputSchema: tool.inputSchema,
    }, async (args) => {
      const result = await executeTool(toolRegistry, context, tool.name, args);
      if (!result.ok) {
        return {
          content: [{ type: 'text' as const, text: JSON.stringify(result.error, null, 2) }],
          isError: true,
        };
      }
      const structured =
        typeof result.result === 'object' && result.result !== null
          ? (result.result as Record<string, unknown>)
          : { value: result.result };
      return { content: [], structuredContent: structured };
    });
  }

  return mcp;
}

export async function handleMcpRequest(request: Request): Promise<Response> {
  const mcp = createMcpServer();
  const transport = new WebStandardStreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
    enableJsonResponse: true,
  });
  await mcp.connect(transport);
  try {
    return await transport.handleRequest(request);
  } finally {
    await transport.close();
    await mcp.close();
  }
}
