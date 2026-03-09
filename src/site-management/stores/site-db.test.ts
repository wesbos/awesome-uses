import { eq } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';
import * as schema from '../../server/schema';
import { createSiteManagementFixture } from '../test-utils';

describe('createSiteDb', () => {
  it('runs and queries SQL statements', async () => {
    const fixture = await createSiteManagementFixture();
    const { db } = fixture.context;

    db.insert(schema.items)
      .values({
        itemSlug: 'vs-code',
        itemName: 'VS Code',
        itemType: 'software',
        description: 'Editor',
        itemUrl: 'https://code.visualstudio.com',
        enrichedAt: new Date().toISOString(),
      })
      .run();

    const row = db
      .select({ itemName: schema.items.itemName })
      .from(schema.items)
      .where(eq(schema.items.itemSlug, 'vs-code'))
      .get();
    expect(row?.itemName).toBe('VS Code');

    const all = db.select({ itemSlug: schema.items.itemSlug }).from(schema.items).all();
    expect(all).toHaveLength(1);

    await fixture.cleanup();
  });
});
