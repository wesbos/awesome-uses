import { PassThrough } from 'stream';
import type { EntryContext } from '@remix-run/node';
import { Response } from '@remix-run/node';
import { RemixServer } from '@remix-run/react';
import { renderToPipeableStream } from 'react-dom/server';

const ABORT_DELAY = 5000;

type CachedResponse = {
  html:string;
  date: Date;
}
const cache = new Map<string, CachedResponse>();


export default function handleRequest(
  request: Request,
  responseStatusCode: number,
  responseHeaders: Headers,
  remixContext: EntryContext
) {
  console.log(request.url);
  // check if we have a cached response in memory
  const cachedResponse = cache.get(request.url);
  if (cachedResponse) {
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


  return new Promise((resolve, reject) => {
    let didError = false;
    const chunks: Uint8Array[] = [];

    const { pipe, abort } = renderToPipeableStream(
      <RemixServer context={remixContext} url={request.url} />,
      {
        onShellReady: () => {
          const body = new PassThrough();

          body
            .on('data', (data) => {
              chunks.push(data);
            })
            .on('end', () => {
              const html = Buffer.concat(chunks).toString('utf8');
              cache.set(request.url, { html: html.replace('Rendered Fresh', `Served from Cache ${new Date().toString()}`), date: new Date() });
            })

          responseHeaders.set('Content-Type', 'text/html');

          resolve(
            new Response(body, {
              headers: responseHeaders,
              status: didError ? 500 : responseStatusCode,
            })
          );

          pipe(body);
        },
        onShellError: (err: unknown) => {
          reject(err);
        },
        onError: (error: unknown) => {
          didError = true;

          console.error(error);
        }
      }
    );

    setTimeout(abort, ABORT_DELAY);
  });
}
