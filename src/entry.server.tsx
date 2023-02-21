import type { EntryContext } from '@remix-run/node';
import { RemixServer } from '@remix-run/react';
import { renderToReadableStream } from 'react-dom/server';

const ABORT_DELAY = 5000;

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
  // // check if we have a cached response in memory
  // const cachedResponse = cache.get(request.url);
  // if (cachedResponse) {
  //   console.log('Serving from cache', request.url);
  //   // if we have a cached response, check if it's less than 5 seconds old
  //   const now = new Date();
  //   const diff = now.getTime() - cachedResponse.date.getTime();
  //   if (true || diff < 5000) {
  //     // if it's less than 5 seconds old, return the cached response
  //     responseHeaders.set('Content-Type', 'text/html');
  //     return new Response(cachedResponse.html, {
  //       headers: responseHeaders,
  //       status: responseStatusCode,
  //     });
  //   }
  // }


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

  // body.pip
  //   .on('data', (data) => {
  //     console.log('data', data);
  //     chunks.push(data);
  //   })
  //   .on('end', () => {
  //     const html = Buffer.concat(chunks).toString('utf8');
  //     cache.set(request.url, { html: html.replace('Rendered Fresh', `Served from Cache ${new Date().toString()}`), date: new Date() });
  //   })

  const headers = new Headers(responseHeaders);
  headers.set("Content-Type", "text/html");
  return new Response(body, {
    headers,
    status: didError ? 500 : responseStatusCode,
  })

}
