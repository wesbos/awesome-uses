import { createFileRoute } from '@tanstack/react-router';
import { handleMcpRequest } from '../site-management/mcp';

export const Route = createFileRoute('/mcp')({
  server: {
    handlers: {
      GET: async ({ request }: { request: Request }) => handleMcpRequest(request),
      POST: async ({ request }: { request: Request }) => handleMcpRequest(request),
      DELETE: async ({ request }: { request: Request }) => handleMcpRequest(request),
    },
  },
} as any);
