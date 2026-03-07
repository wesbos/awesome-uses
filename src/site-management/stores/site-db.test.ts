import { describe, expect, it } from 'vitest';
import { createSiteManagementFixture } from '../test-utils';

describe('SiteDbStore', () => {
  it('runs and queries SQL statements', async () => {
    const fixture = await createSiteManagementFixture();
    const { siteDb } = fixture.context;

    siteDb.run(
      `INSERT INTO items (item_slug, item_name, item_type, description, item_url, enriched_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
      ['vs-code', 'VS Code', 'software', 'Editor', 'https://code.visualstudio.com', new Date().toISOString()],
    );

    const row = siteDb.get<{ item_name: string }>(
      'SELECT item_name FROM items WHERE item_slug = ?',
      ['vs-code'],
    );
    expect(row?.item_name).toBe('VS Code');

    const all = siteDb.all<{ item_slug: string }>('SELECT item_slug FROM items');
    expect(all).toHaveLength(1);

    await fixture.cleanup();
  });
});
