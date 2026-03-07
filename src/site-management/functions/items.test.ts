import { describe, expect, it } from 'vitest';
import { executeTool, toolRegistry } from '..';
import { createSiteManagementFixture } from '../test-utils';

describe('items tools', () => {
  it('upserts enrichments and merges duplicate item variants', async () => {
    const fixture = await createSiteManagementFixture();

    fixture.context.siteDb.run(
      `INSERT INTO person_items (person_slug, item, tags_json, detail, extracted_at)
       VALUES
       ('ada-lovelace', 'VSCode', '["editor"]', null, ?),
       ('grace-hopper', 'VS Code', '["editor"]', null, ?)`,
      [new Date().toISOString(), new Date().toISOString()],
    );

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
      expect(merge.result.deletedRows).toBeGreaterThan(0);
    }

    await fixture.cleanup();
  });
});
