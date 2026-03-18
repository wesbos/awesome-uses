import { createFileRoute } from '@tanstack/react-router';
import { getDirectAvatarUrl } from '../lib/avatar';
import { getPersonBySlug } from '../lib/data';
import { resolveAvatarsBucket } from '../server/avatars-bucket.server';

export const Route = createFileRoute('/api/avatar/$slug')({
  server: {
    handlers: {
      GET: async ({ params }: { params: { slug: string }; request: Request }) => {
        const { slug } = params;

        // Try to get from R2 if available
        try {
          const bucket = resolveAvatarsBucket();
          if (bucket) {
            const object = await bucket.get(`${slug}.png`);
            if (object) {
              return new Response(object.body as BodyInit, {
                headers: {
                  'content-type': object.httpMetadata?.contentType ?? 'image/png',
                  'cache-control': 'public, max-age=86400',
                },
              });
            }
          }
        } catch (err) {
          console.log('[avatar] R2 read failed, falling back to redirect:', err);
        }

        // Fallback: proxy from unavatar with API key
        const person = getPersonBySlug(slug);
        if (!person) {
          return new Response('Not found', { status: 404 });
        }

        const fallbackUrl = getDirectAvatarUrl(person);
        const headers: Record<string, string> = {};
        const apiKey = process.env.UNAVATAR_API_KEY;
        if (apiKey) headers['x-api-key'] = apiKey;

        try {
          const upstream = await fetch(fallbackUrl, { headers, signal: AbortSignal.timeout(10_000) });
          if (!upstream.ok) {
            return new Response(`Upstream ${upstream.status}`, { status: upstream.status });
          }
          return new Response(upstream.body as BodyInit, {
            headers: {
              'content-type': upstream.headers.get('content-type') ?? 'image/png',
              'cache-control': 'public, max-age=86400',
            },
          });
        } catch (err) {
          console.log('[avatar] unavatar proxy failed:', err);
          return new Response('Upstream fetch failed', { status: 502 });
        }
      },
    },
  },
} as any);
