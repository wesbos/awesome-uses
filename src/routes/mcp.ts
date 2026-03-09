import { createFileRoute } from '@tanstack/react-router';
import { handleMcpHttpRequest } from '../site-management/http';

export const Route = createFileRoute('/mcp')({
  server: {
    handlers: {
      GET: async ({ request }: { request: Request }) => handleMcpHttpRequest(request),
      POST: async ({ request }: { request: Request }) => handleMcpHttpRequest(request),
    },
  },
} as any);
