import { afterEach, describe, expect, it, vi } from 'vite-plus/test';
import * as schema from '../../server/schema';
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
    const extractedAt = new Date().toISOString();
    fixture.context.db.insert(schema.personItems).values([
      { personSlug: 'ada-lovelace', item: 'VS Code', tagsJson: '["editor","productivity"]', extractedAt },
      { personSlug: 'grace-hopper', item: 'Vim', tagsJson: '["editor"]', extractedAt },
    ]).run();

    const review = await executeTool(toolRegistry, fixture.context, 'pipeline.reviewExtraction', {});
    expect(review.ok).toBe(true);
    if (review.ok) {
      const payload = review.result as { totalRows: number; totalTags: number };
      expect(payload.totalRows).toBe(2);
      expect(payload.totalTags).toBeGreaterThan(0);
    }

    await fixture.cleanup();
  });
});
