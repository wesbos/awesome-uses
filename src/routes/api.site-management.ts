import { createFileRoute } from '@tanstack/react-router';
import { handleSiteManagementApiRequest } from '../site-management/http';

export const Route = createFileRoute('/api/site-management')({
  server: {
    handlers: {
      GET: async ({ request }: { request: Request }) => handleSiteManagementApiRequest(request),
      POST: async ({ request }: { request: Request }) => handleSiteManagementApiRequest(request),
    },
  },
} as any);
