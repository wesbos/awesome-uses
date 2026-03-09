import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { WebStandardStreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js';
import { allTools } from './tools';
import { createSiteManagementContext } from './context';

function createMcpServer(): McpServer {
  const mcp = new McpServer(
    { name: 'uses-site-management', version: '1.0.0' },
    { capabilities: { tools: { listChanged: false } } },
  );

  const context = createSiteManagementContext();

  for (const tool of allTools) {
    mcp.registerTool(tool.name, {
      description: tool.description,
      inputSchema: tool.inputSchema,
    }, async (args) => {
      try {
        const result = await tool.handler(context, args);
        return {
          content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
        };
      } catch (error) {
        return {
          content: [{ type: 'text', text: error instanceof Error ? error.message : String(error) }],
          isError: true,
        };
      }
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
