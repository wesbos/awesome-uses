import { setTimeout as delay } from 'node:timers/promises';
import TurndownService from 'turndown';

export type ScrapePageResult = {
  statusCode: number | null;
  title: string | null;
  contentMarkdown: string | null;
  contentHash: string | null;
};

function htmlToMarkdown(html: string): string {
  const cleaned = html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<nav[\s\S]*?<\/nav>/gi, '')
    .replace(/<footer[\s\S]*?<\/footer>/gi, '');

  const td = new TurndownService({ headingStyle: 'atx', codeBlockStyle: 'fenced' });
  return td.turndown(cleaned).trim();
}

function extractTagContent(html: string, regex: RegExp): string | null {
  const match = html.match(regex);
  return match?.[1]?.trim() || null;
}

async function fetchWithRetry(url: string, timeoutMs: number, retries: number) {
  let lastError: unknown;
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      const response = await fetch(url, {
        method: 'GET',
        redirect: 'follow',
        signal: AbortSignal.timeout(timeoutMs),
        headers: {
          'User-Agent': 'uses.tech-on-demand-scraper/1.0 (+https://uses.tech)',
          Accept: 'text/html,*/*',
        },
      });
      return response;
    } catch (error) {
      lastError = error;
      if (attempt < retries) {
        await delay(Math.min(350 * (attempt + 1), 2000));
      }
    }
  }
  throw lastError;
}

export async function scrapeUsesPage(
  url: string,
  options: { timeoutMs?: number; retries?: number } = {}
): Promise<ScrapePageResult> {
  const timeoutMs = options.timeoutMs ?? 12_000;
  const retries = options.retries ?? 1;

  try {
    const response = await fetchWithRetry(url, timeoutMs, retries);
    const contentType = response.headers.get('content-type') || '';
    const isHtml = contentType.includes('text/html');
    if (!isHtml) {
      return {
        statusCode: response.status,
        title: null,
        contentMarkdown: null,
        contentHash: null,
      };
    }

    const html = await response.text();
    const markdown = htmlToMarkdown(html);

    const contentHash = markdown
      ? await crypto.subtle
          .digest('SHA-256', new TextEncoder().encode(markdown))
          .then((buffer) =>
            Array.from(new Uint8Array(buffer))
              .map((byte) => byte.toString(16).padStart(2, '0'))
              .join('')
          )
      : null;

    return {
      statusCode: response.status,
      title: extractTagContent(html, /<title[^>]*>([\s\S]*?)<\/title>/i),
      contentMarkdown: markdown ? markdown.slice(0, 20_000) : null,
      contentHash,
    };
  } catch {
    return {
      statusCode: null,
      title: null,
      contentMarkdown: null,
      contentHash: null,
    };
  }
}
