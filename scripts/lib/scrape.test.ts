import { describe, expect, it } from 'vitest';
import {
  buildScrapeRecordFromHtml,
  extractTagContent,
  htmlToMarkdown,
  sqlValue,
} from './scrape';

describe('scrape helpers', () => {
  it('htmlToMarkdown converts HTML to markdown, stripping scripts and styles', () => {
    const html = `
      <html>
        <head>
          <style>.x { color: red; }</style>
          <script>window.alert('x')</script>
        </head>
        <body>
          <h1>Hello World</h1>
          <p>Fish &amp; Chips &lt;3</p>
        </body>
      </html>
    `;

    const md = htmlToMarkdown(html);
    expect(md).toContain('# Hello World');
    expect(md).toContain('Fish & Chips <3');
  });

  it('extractTagContent returns null when regex does not match', () => {
    expect(extractTagContent('<div>test</div>', /<title>(.*?)<\/title>/i)).toBeNull();
  });

  it('sqlValue escapes apostrophes and handles null', () => {
    expect(sqlValue("it's me")).toBe("'it''s me'");
    expect(sqlValue(null)).toBe('NULL');
    expect(sqlValue(42)).toBe('42');
  });

  it('buildScrapeRecordFromHtml computes text metadata', () => {
    const html = `
      <html>
        <head>
          <title>Uses page</title>
          <meta name="description" content="My setup" />
        </head>
        <body>
          <h1>Uses</h1>
          <p>Keyboard monitor editor terminal</p>
        </body>
      </html>
    `;

    const record = buildScrapeRecordFromHtml(
      'person-1',
      'https://example.com/uses',
      200,
      html,
      '2026-01-01T00:00:00.000Z'
    );

    expect(record.title).toBe('Uses page');
    expect(record.contentHash).toMatch(/^[a-f0-9]{64}$/);
  });
});
