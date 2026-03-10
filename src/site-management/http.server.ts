import { createSiteManagementContext } from './context';
import { resolveDb } from '../server/db/connection.server';
import { executeTool } from './executor';
import { sortedTools, toolRegistry } from './tools';
import type { SiteDb } from './stores/site-db';

function resolveServerDb(): SiteDb | null {
  const db = resolveDb();
  return db ? (db as unknown as SiteDb) : null;
}

export type JsonRpcRequest = {
  jsonrpc?: string;
  id?: string | number | null;
  method?: string;
  params?: Record<string, unknown>;
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body, null, 2), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
    },
  });
}

export async function handleSiteManagementApiRequest(request: Request): Promise<Response> {
  if (request.method === 'GET') {
    return json({
      ok: true,
      service: 'site-management-api',
      endpoints: {
        tools: '/api/site-management',
        call: '/api/site-management',
      },
      tools: sortedTools.map((tool) => ({
        name: tool.name,
        scope: tool.scope,
        description: tool.description,
      })),
    });
  }

  if (request.method !== 'POST') {
    return json({ ok: false, error: { code: 'METHOD_NOT_ALLOWED', message: 'Use GET or POST.' } }, 405);
  }

  try {
    const body = (await request.json()) as { tool?: string; input?: unknown };
    if (!body?.tool || typeof body.tool !== 'string') {
      return json(
        {
          ok: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Request body must include a string "tool" field.',
          },
        },
        400,
      );
    }

    const d1 = resolveServerDb();
    const context = d1
      ? createSiteManagementContext({ db: d1 })
      : createSiteManagementContext();
    const result = await executeTool(toolRegistry, context, body.tool, body.input ?? {});
    return json(result, result.ok ? 200 : 400);
  } catch (error) {
    return json(
      {
        ok: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: error instanceof Error ? error.message : 'Failed to execute tool.',
        },
      },
      500,
    );
  }
}

function rpcResult(id: JsonRpcRequest['id'], result: unknown) {
  return json(
    {
      jsonrpc: '2.0',
      id: id ?? null,
      result,
    },
    200,
  );
}

function rpcError(id: JsonRpcRequest['id'], code: number, message: string, data?: unknown) {
  return json(
    {
      jsonrpc: '2.0',
      id: id ?? null,
      error: { code, message, ...(typeof data !== 'undefined' ? { data } : {}) },
    },
    400,
  );
}

export async function handleMcpHttpRequest(request: Request): Promise<Response> {
  if (request.method === 'GET') {
    return json({
      ok: true,
      message: 'MCP endpoint available at POST /mcp (JSON-RPC 2.0).',
      methods: ['initialize', 'tools/list', 'tools/call'],
    });
  }

  if (request.method !== 'POST') {
    return rpcError(null, -32600, 'Invalid Request');
  }

  let payload: JsonRpcRequest;
  try {
    payload = (await request.json()) as JsonRpcRequest;
  } catch {
    return rpcError(null, -32700, 'Parse error');
  }

  if (payload.jsonrpc !== '2.0' || !payload.method) {
    return rpcError(payload.id ?? null, -32600, 'Invalid Request');
  }

  if (payload.method === 'initialize') {
    return rpcResult(payload.id, {
      protocolVersion: '2025-03-26',
      serverInfo: { name: 'uses-site-management', version: '1.0.0' },
      capabilities: {
        tools: { listChanged: false },
      },
    });
  }

  if (payload.method === 'tools/list') {
    return rpcResult(payload.id, {
      tools: sortedTools.map((tool) => ({
        name: tool.name,
        description: tool.description,
        inputSchema: { type: 'object' },
      })),
    });
  }

  if (payload.method === 'tools/call') {
    const name = payload.params?.name;
    const args = payload.params?.arguments;
    if (typeof name !== 'string') {
      return rpcError(payload.id, -32602, 'Invalid params: "name" is required.');
    }

    const d1 = resolveServerDb();
    const context = d1
      ? createSiteManagementContext({ db: d1 })
      : createSiteManagementContext();
    const result = await executeTool(toolRegistry, context, name, args ?? {});
    if (!result.ok) {
      return rpcResult(payload.id, {
        content: [{ type: 'text', text: JSON.stringify(result.error, null, 2) }],
        isError: true,
      });
    }

    return rpcResult(payload.id, {
      content: [{ type: 'text', text: JSON.stringify(result.result, null, 2) }],
      structuredContent:
        typeof result.result === 'object' && result.result !== null
          ? result.result
          : { value: result.result },
    });
  }

  return rpcError(payload.id, -32601, `Method not found: ${payload.method}`);
}
