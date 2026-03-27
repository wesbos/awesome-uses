import { createFileRoute } from '@tanstack/react-router';

const UNAVATAR_BASE = process.env.UNAVATAR_BASE_URL || 'https://unavatar.io';

function buildUnavatarUrl(service: string, identifier: string): string {
  return service === 'domain'
    ? `${UNAVATAR_BASE}/${identifier}`
    : `${UNAVATAR_BASE}/${service}/${identifier}`;
}

export const Route = createFileRoute('/api/unavatar/$service/$identifier')({
  server: {
    handlers: {
      // TODO: reject requests where the service/identifier combo doesn't belong to a person in our database,
      // so this proxy can't be used as an open relay for arbitrary unavatar lookups.
      GET: async ({ params, request }: { params: { service: string; identifier: string }; request: Request }) => {
        const reqHeaders: Record<string, string> = {};
        const apiKey = process.env.UNAVATAR_API_KEY;
        if (apiKey) reqHeaders['x-api-key'] = apiKey;

        // Build the list of sources to try: primary from path, then fallbacks from query
        const url = new URL(request.url);
        const sources: Array<{ service: string; identifier: string }> = [
          { service: params.service, identifier: params.identifier },
        ];
        const fallbackParam = url.searchParams.get('fallback');
        if (fallbackParam) {
          for (const pair of fallbackParam.split(',')) {
            const colonIdx = pair.indexOf(':');
            if (colonIdx !== -1) {
              sources.push({
                service: pair.slice(0, colonIdx),
                identifier: pair.slice(colonIdx + 1),
              });
            }
          }
        }

        // Try each source in order until one returns an image
        for (const source of sources) {
          const unavatarUrl = buildUnavatarUrl(source.service, source.identifier);
          try {
            const upstream = await fetch(unavatarUrl, {
              headers: reqHeaders,
              signal: AbortSignal.timeout(10_000),
            });

            if (!upstream.ok) {
              console.log(`[unavatar proxy] ${source.service}/${source.identifier} returned ${upstream.status}, trying next`);
              continue;
            }

            const contentType = upstream.headers.get('content-type') ?? '';
            if (!contentType.includes('image')) {
              console.log(`[unavatar proxy] ${source.service}/${source.identifier} returned non-image (${contentType}), trying next`);
              continue;
            }

            return new Response(upstream.body as BodyInit, {
              headers: {
                'content-type': contentType,
                'cache-control': 'public, max-age=86400',
              },
            });
          } catch (err) {
            console.log(`[unavatar proxy] ${source.service}/${source.identifier} failed:`, err);
            continue;
          }
        }

        return new Response('No avatar found from any source', { status: 404 });
      },
    },
  },
} as any);
