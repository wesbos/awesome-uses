import type { EntryContext } from '@remix-run/node';
import { RemixServer } from '@remix-run/react';
import { renderToReadableStream } from 'react-dom/server';

const ABORT_DELAY = 5000;
const CACHE_TTL = 5000;
const CACHE_MAX_ENTRIES = 100;
const CACHE_MAX_URL_LENGTH = 2048;
const CACHE_MAX_HTML_BYTES = 1024 * 1024;

export async function streamToText(
  stream: ReadableStream<Uint8Array>
): Promise<string | null> {
  let result = '';
  let bytes = 0;
  const decoder = new TextDecoder();
  const reader = stream.getReader();
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const { done, value } = await reader.read();
    if (done) {
      break;
    }

    bytes += value.byteLength;
    if (bytes > CACHE_MAX_HTML_BYTES) {
      reader.cancel().catch((error) => console.error(error));
      return null;
    }
    result += decoder.decode(value, { stream: true });
  }
  return result + decoder.decode();
}

type CachedResponse = {
  html: string;
  date: Date;
};
const cache = new Map<string, CachedResponse>();

export default async function handleRequest(
  request: Request,
  responseStatusCode: number,
  responseHeaders: Headers,
  remixContext: EntryContext
) {
  // check if we have a cached response in memory
  const cachedResponse = cache.get(request.url);
  if (cachedResponse) {
    // console.log('Serving from cache', request.url);
    // if we have a cached response, check if it's less than 5 seconds old
    const now = new Date();
    const diff = now.getTime() - cachedResponse.date.getTime();
    if (diff < CACHE_TTL) {
      // if it's less than 5 seconds old, return the cached response
      responseHeaders.set('Content-Type', 'text/html');
      return new Response(cachedResponse.html, {
        headers: responseHeaders,
        status: responseStatusCode,
      });
    }
    cache.delete(request.url);
  }

  let didError = false;
  const chunks: Uint8Array[] = [];

  const body = await renderToReadableStream(
    <RemixServer context={remixContext} url={request.url} />,
    {
      onError: (error: unknown) => {
        didError = true;
        console.error(error);
      },
    }
  );

  let toResponse: ReadableStream<Uint8Array> = body;
  if (request.url.length <= CACHE_MAX_URL_LENGTH) {
    // tee the stream so we can cache it and send it to the client
    const [clientStream, toCache] = (body as ReadableStream<Uint8Array>).tee();
    toResponse = clientStream;

    streamToText(toCache)
      .then((html) => {
        if (html === null) return;
        const cachedHtml = html.replace(
          'Rendered Fresh',
          `Rendered from cache ${new Date().toISOString()}`
        );
        if (
          new TextEncoder().encode(cachedHtml).byteLength > CACHE_MAX_HTML_BYTES
        )
          return;
        console.log('Caching', request.url);
        cache.delete(request.url);
        if (cache.size >= CACHE_MAX_ENTRIES) {
          const oldest = cache.keys().next().value as string | undefined;
          if (oldest !== undefined) cache.delete(oldest);
        }
        cache.set(request.url, {
          html: cachedHtml,
          date: new Date(),
        });
      })
      .catch((error) => console.error(error));
  }

  const headers = new Headers(responseHeaders);
  headers.set('Content-Type', 'text/html');
  const response = new Response(toResponse, {
    headers,
    status: didError ? 500 : responseStatusCode,
  });
  return response;
}
