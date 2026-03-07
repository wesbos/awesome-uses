#!/usr/bin/env tsx
import * as http from 'node:http';
import { URL } from 'node:url';
import { createSiteManagementContext, executeTool, sortedTools, toolRegistry } from '../src/site-management';

type ApiServerOptions = {
  port: number;
  host: string;
};

function parseArgs(argv: string[]): ApiServerOptions {
  const readFlag = (flag: string): string | undefined => {
    const index = argv.indexOf(flag);
    if (index === -1) return undefined;
    return argv[index + 1];
  };

  const port = Number(readFlag('--port') ?? process.env.SITE_MANAGEMENT_API_PORT ?? 8788);
  const host = readFlag('--host') ?? process.env.SITE_MANAGEMENT_API_HOST ?? '127.0.0.1';

  return {
    port: Number.isFinite(port) ? port : 8788,
    host,
  };
}

async function readJsonBody(req: http.IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  if (chunks.length === 0) return {};
  const raw = Buffer.concat(chunks).toString('utf8').trim();
  if (!raw) return {};
  return JSON.parse(raw);
}

function sendJson(res: http.ServerResponse, statusCode: number, payload: unknown) {
  res.statusCode = statusCode;
  res.setHeader('content-type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(payload, null, 2));
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const context = createSiteManagementContext();

  const server = http.createServer(async (req, res) => {
    try {
      if (!req.url || !req.method) {
        sendJson(res, 400, { ok: false, error: 'Invalid request.' });
        return;
      }

      const url = new URL(req.url, `http://${options.host}:${options.port}`);
      if (req.method === 'GET' && url.pathname === '/health') {
        sendJson(res, 200, {
          ok: true,
          service: 'site-management-api',
          dbPath: context.dbPath,
        });
        return;
      }

      if (req.method === 'GET' && url.pathname === '/tools') {
        sendJson(res, 200, {
          ok: true,
          total: sortedTools.length,
          rows: sortedTools.map((tool) => ({
            name: tool.name,
            scope: tool.scope,
            description: tool.description,
          })),
        });
        return;
      }

      if (req.method === 'POST' && url.pathname.startsWith('/tools/')) {
        const toolName = decodeURIComponent(url.pathname.replace('/tools/', ''));
        const body = (await readJsonBody(req)) as { input?: unknown };
        const result = await executeTool(toolRegistry, context, toolName, body?.input ?? {});
        sendJson(res, result.ok ? 200 : 400, result);
        return;
      }

      sendJson(res, 404, { ok: false, error: 'Not found.' });
    } catch (error) {
      sendJson(res, 500, {
        ok: false,
        error: error instanceof Error ? error.message : 'Unhandled server error.',
      });
    }
  });

  server.listen(options.port, options.host, () => {
    console.log(
      JSON.stringify(
        {
          ok: true,
          service: 'site-management-api',
          host: options.host,
          port: options.port,
        },
        null,
        2,
      ),
    );
  });
}

void main();
