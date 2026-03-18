import { createFileRoute } from '@tanstack/react-router';
import { getAvatarUrl } from '../lib/avatar';
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

        // Fallback: redirect to unavatar.io
        const person = getPersonBySlug(slug);
        if (!person) {
          return new Response('Not found', { status: 404 });
        }

        const fallbackUrl = getAvatarUrl(person);
        return new Response(null, {
          status: 302,
          headers: { location: fallbackUrl },
        });
      },
    },
  },
} as any);
