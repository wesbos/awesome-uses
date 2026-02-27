import { createFileRoute } from '@tanstack/react-router';
import { getPersonBySlug } from '../lib/data';
import { getScrapedProfileBySlug, upsertScrapedProfile } from '../server/d1';
import { scrapeUsesPage } from '../server/scrape';

export const Route = createFileRoute('/api/scrape/$personSlug')({
  server: {
    handlers: {
      GET: async ({ params, context }) => {
        const existing = await getScrapedProfileBySlug(params.personSlug, context);
        if (existing) {
          return Response.json({ data: existing, mode: 'existing' });
        }

        const person = getPersonBySlug(params.personSlug);
        if (!person) {
          return Response.json(
            { data: null, mode: 'missing-person' },
            { status: 404 }
          );
        }

        const fetchedAt = new Date().toISOString();
        const scraped = await scrapeUsesPage(person.url);
        await upsertScrapedProfile(
          person.personSlug,
          person.url,
          fetchedAt,
          scraped,
          context
        );

        const created = await getScrapedProfileBySlug(params.personSlug, context);
        if (created) {
          return Response.json({ data: created, mode: 'scraped-on-demand' });
        }

        return Response.json(
          {
            data: {
              personSlug: person.personSlug,
              url: person.url,
              statusCode: scraped.statusCode,
              fetchedAt,
              title: scraped.title,
              description: scraped.description,
              excerpt: scraped.excerpt,
              wordCount: scraped.wordCount,
              readingMinutes: scraped.readingMinutes,
            },
            mode: 'scraped-on-demand',
          },
          { status: 200 }
        );
      },
    },
  },
});
