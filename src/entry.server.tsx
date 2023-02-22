import type { EntryContext } from '@remix-run/node';
import { RemixServer } from '@remix-run/react';
import { renderToReadableStream } from 'react-dom/server';

const ABORT_DELAY = 5000;

export async function streamToText(stream: ReadableStream<Uint8Array>): Promise<string> {
  let result = '';
  const reader = stream.pipeThrough(new TextDecoderStream()).getReader();
  while (true) { // eslint-disable-line no-constant-condition
    const { done, value } = await reader.read();
    if (done) {
      break;
    }

    result += value;
  }
  return result;
}

type CachedResponse = {
  html: string;
  date: Date;
}
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
    console.log('Serving from cache', request.url);
    // if we have a cached response, check if it's less than 5 seconds old
    const now = new Date();
    const diff = now.getTime() - cachedResponse.date.getTime();
    if (true || diff < 5000) {
      // if it's less than 5 seconds old, return the cached response
      responseHeaders.set('Content-Type', 'text/html');
      return new Response(cachedResponse.html, {
        headers: responseHeaders,
        status: responseStatusCode,
      });
    }
  }

  let didError = false;
  const chunks: Uint8Array[] = [];

  const body = await renderToReadableStream(
    <RemixServer context={remixContext} url={request.url} />,
    {
      onError: (error: unknown) => {
        didError = true;
        console.error(error);
      }
    }
  );

  // tee the stream so we can cache it and send it to the client
  const [toReponse, toCache] = body.tee();

  streamToText(toCache).then(html => {
    console.log('Caching', request.url);
    cache.set(request.url, {
      html: html.replace('Rendered Fresh',`Rendered from cache ${new Date().toISOString()}`),
      date: new Date(),
    });
  });

  const headers = new Headers(responseHeaders);
  headers.set("Content-Type", "text/html");
  const response = new Response(toReponse, {
    headers,
    status: didError ? 500 : responseStatusCode,
  });
  return response;
}
