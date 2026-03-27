import { createFileRoute } from '@tanstack/react-router';
import { resolveAvatarsBucket } from '../server/avatars-bucket.server';

export const Route = createFileRoute('/api/avatar-debug/$')({
  server: {
    handlers: {
      GET: async ({ request }: { params: Record<string, string>; request: Request }) => {
        const url = new URL(request.url);
        const key = url.pathname.replace('/api/avatar-debug/', '');
        if (!key) {
          return new Response('Missing key', { status: 400 });
        }

        const bucket = resolveAvatarsBucket();
        if (!bucket) {
          return new Response('No R2 bucket', { status: 503 });
        }

        const object = await bucket.get(key);
        if (!object) {
          return new Response('Not found', { status: 404 });
        }

        return new Response(object.body as BodyInit, {
          headers: {
            'content-type': object.httpMetadata?.contentType ?? 'image/png',
            'cache-control': 'no-cache',
          },
        });
      },
    },
  },
} as any);
