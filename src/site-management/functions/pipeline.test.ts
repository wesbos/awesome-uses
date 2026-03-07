import { afterEach, describe, expect, it, vi } from 'vitest';
import { executeTool, toolRegistry } from '..';
import { createSiteManagementFixture } from '../test-utils';

describe('pipeline tools', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('scrapes one person and reports status', async () => {
    const fixture = await createSiteManagementFixture();

    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        return new Response(
          `<html><head><title>Ada Uses</title></head><body><h1>Tools</h1><p>VS Code</p></body></html>`,
          {
            status: 200,
            headers: { 'content-type': 'text/html' },
          },
        );
      }),
    );

    const scrape = await executeTool(toolRegistry, fixture.context, 'pipeline.scrapePerson', {
      personSlug: 'ada-lovelace',
      timeoutMs: 5000,
      retries: 0,
    });
    expect(scrape.ok).toBe(true);

    const status = await executeTool(toolRegistry, fixture.context, 'pipeline.getScrapeStatus', {});
    expect(status.ok).toBe(true);
    if (status.ok) {
      const payload = status.result as { scraped: number };
      expect(payload.scraped).toBeGreaterThan(0);
    }

    await fixture.cleanup();
  });

  it('builds extraction review from existing person_items', async () => {
    const fixture = await createSiteManagementFixture();
    fixture.context.siteDb.run(
      `INSERT INTO person_items (person_slug, item, tags_json, detail, extracted_at)
       VALUES
       ('ada-lovelace', 'VS Code', '["editor","productivity"]', null, ?),
       ('grace-hopper', 'Vim', '["editor"]', null, ?)`,
      [new Date().toISOString(), new Date().toISOString()],
    );

    const review = await executeTool(toolRegistry, fixture.context, 'pipeline.reviewExtraction', {});
    expect(review.ok).toBe(true);
    if (review.ok) {
      const payload = review.result as { totalRows: number; totalCategories: number };
      expect(payload.totalRows).toBe(2);
      expect(payload.totalCategories).toBeGreaterThan(0);
    }

    await fixture.cleanup();
  });
});
