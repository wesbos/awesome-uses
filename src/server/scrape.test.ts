import { afterEach, describe, expect, it, vi } from 'vitest';
import { scrapeUsesPage } from './scrape';

describe('scrapeUsesPage', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('parses HTML metadata and content stats', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        return new Response(
          `
          <html>
            <head>
              <title>My Uses</title>
              <meta name="description" content="Tools and setup" />
            </head>
            <body>
              <h1>Uses</h1>
              <p>Keyboard monitor editor terminal.</p>
            </body>
          </html>
        `,
          { status: 200, headers: { 'content-type': 'text/html' } }
        );
      })
    );

    const result = await scrapeUsesPage('https://example.com/uses');
    expect(result.statusCode).toBe(200);
    expect(result.title).toBe('My Uses');
    expect(result.contentHash).toMatch(/^[a-f0-9]{64}$/);
  });

  it('handles non-html responses without text extraction', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        return new Response('ok', {
          status: 200,
          headers: { 'content-type': 'application/json' },
        });
      })
    );

    const result = await scrapeUsesPage('https://example.com/api');
    expect(result.statusCode).toBe(200);
    expect(result.title).toBeNull();
  });
});
