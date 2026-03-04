import { createHash } from 'node:crypto';
import TurndownService from 'turndown';

export type ScrapeRecord = {
  personSlug: string;
  url: string;
  statusCode: number | null;
  fetchedAt: string;
  title: string | null;
  contentMarkdown: string | null;
  contentHash: string | null;
};

export function htmlToMarkdown(html: string): string {
  const cleaned = html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<nav[\s\S]*?<\/nav>/gi, '')
    .replace(/<footer[\s\S]*?<\/footer>/gi, '');

  const td = new TurndownService({ headingStyle: 'atx', codeBlockStyle: 'fenced' });
  return td.turndown(cleaned).trim();
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
  const markdown = htmlToMarkdown(html);

  return {
    personSlug,
    url,
    statusCode,
    fetchedAt,
    title: extractTagContent(html, /<title[^>]*>([\s\S]*?)<\/title>/i),
    contentMarkdown: markdown ? markdown.slice(0, 20_000) : null,
    contentHash: markdown ? createHash('sha256').update(markdown).digest('hex') : null,
  };
}
