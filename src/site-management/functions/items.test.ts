import { describe, expect, it } from 'vitest';
import * as schema from '../../server/schema';
import { executeTool, toolRegistry } from '..';
import { createSiteManagementFixture } from '../test-utils';

describe('items tools', () => {
  it('upserts enrichments and merges duplicate item variants', async () => {
    const fixture = await createSiteManagementFixture();
    const extractedAt = new Date().toISOString();
    fixture.context.db.insert(schema.personItems).values([
      { personSlug: 'ada-lovelace', item: 'VSCode', tagsJson: '["editor"]', extractedAt },
      { personSlug: 'grace-hopper', item: 'VS Code', tagsJson: '["editor"]', extractedAt },
    ]).run();

    const upsert = await executeTool(toolRegistry, fixture.context, 'items.createOrUpsert', {
      itemName: 'VS Code',
      itemType: 'software',
      description: 'Editor',
      itemUrl: 'https://code.visualstudio.com',
    });
    expect(upsert.ok).toBe(true);

    const duplicates = await executeTool(toolRegistry, fixture.context, 'items.findDuplicates', {
      minVariants: 2,
    });
    expect(duplicates.ok).toBe(true);

    const merge = await executeTool(toolRegistry, fixture.context, 'items.merge', {
      canonicalItem: 'VS Code',
      sourceItems: ['VSCode'],
    });
    expect(merge.ok).toBe(true);
    if (merge.ok) {
      const payload = merge.result as { deletedRows: number };
      expect(payload.deletedRows).toBeGreaterThan(0);
    }

    await fixture.cleanup();
  });
});
