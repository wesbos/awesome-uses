import { createHash } from 'node:crypto';

export type ScrapeRecord = {
  personSlug: string;
  url: string;
  statusCode: number | null;
  fetchedAt: string;
  title: string | null;
  description: string | null;
  excerpt: string | null;
  contentText: string | null;
  contentHash: string | null;
  wordCount: number | null;
  readingMinutes: number | null;
};

export function stripHtml(html: string): string {
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

export function extractTagContent(html: string, regex: RegExp): string | null {
  const match = html.match(regex);
  return match?.[1]?.trim() || null;
}

export function sqlValue(value: string | number | null): string {
  if (value === null || typeof value === 'undefined') return 'NULL';
  if (typeof value === 'number') return Number.isFinite(value) ? String(value) : 'NULL';
  return `'${value.replace(/'/g, "''")}'`;
}

export function buildScrapeRecordFromHtml(
  personSlug: string,
  url: string,
  statusCode: number,
  html: string,
  fetchedAt = new Date().toISOString()
): ScrapeRecord {
  const text = stripHtml(html);
  const words = text ? text.split(/\s+/).filter(Boolean).length : 0;
  const readingMinutes = words > 0 ? Math.max(1, Math.round(words / 220)) : null;

  return {
    personSlug,
    url,
    statusCode,
    fetchedAt,
    title: extractTagContent(html, /<title[^>]*>([\s\S]*?)<\/title>/i),
    description: extractTagContent(
      html,
      /<meta\s+name=["']description["']\s+content=["']([\s\S]*?)["'][^>]*>/i
    ),
    excerpt: text ? text.slice(0, 600) : null,
    contentText: text ? text.slice(0, 20_000) : null,
    contentHash: text ? createHash('sha256').update(text).digest('hex') : null,
    wordCount: words || null,
    readingMinutes,
  };
}
