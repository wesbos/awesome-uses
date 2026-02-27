import { createFileRoute } from '@tanstack/react-router';
import { getScrapedProfileBySlug } from '../server/d1';

export const Route = createFileRoute('/api/scrape/$personSlug')({
  server: {
    handlers: {
      GET: async ({ params, context }) => {
        const data = await getScrapedProfileBySlug(params.personSlug, context);
        return Response.json({ data });
      },
    },
  },
});
