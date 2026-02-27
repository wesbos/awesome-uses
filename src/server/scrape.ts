import { setTimeout as delay } from 'node:timers/promises';

export type ScrapePageResult = {
  statusCode: number | null;
  title: string | null;
  description: string | null;
  excerpt: string | null;
  contentText: string | null;
  contentHash: string | null;
  wordCount: number | null;
  readingMinutes: number | null;
};

function stripHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/\s+/g, ' ')
    .trim();
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
        description: null,
        excerpt: null,
        contentText: null,
        contentHash: null,
        wordCount: null,
        readingMinutes: null,
      };
    }

    const html = await response.text();
    const text = stripHtml(html);
    const words = text ? text.split(/\s+/).filter(Boolean).length : 0;
    const readingMinutes = words > 0 ? Math.max(1, Math.round(words / 220)) : null;

    const contentHash = text
      ? await crypto.subtle
          .digest('SHA-256', new TextEncoder().encode(text))
          .then((buffer) =>
            Array.from(new Uint8Array(buffer))
              .map((byte) => byte.toString(16).padStart(2, '0'))
              .join('')
          )
      : null;

    return {
      statusCode: response.status,
      title: extractTagContent(html, /<title[^>]*>([\s\S]*?)<\/title>/i),
      description: extractTagContent(
        html,
        /<meta\s+name=["']description["']\s+content=["']([\s\S]*?)["'][^>]*>/i
      ),
      excerpt: text ? text.slice(0, 600) : null,
      contentText: text ? text.slice(0, 20_000) : null,
      contentHash,
      wordCount: words || null,
      readingMinutes,
    };
  } catch {
    return {
      statusCode: null,
      title: null,
      description: null,
      excerpt: null,
      contentText: null,
      contentHash: null,
      wordCount: null,
      readingMinutes: null,
    };
  }
}
