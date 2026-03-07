import { describe, expect, it } from 'vitest';
import { executeTool, toolRegistry } from '..';
import { createSiteManagementFixture } from '../test-utils';

describe('category tools', () => {
  it('lists and renames extracted categories', async () => {
    const fixture = await createSiteManagementFixture();
    fixture.context.siteDb.run(
      `INSERT INTO person_items (person_slug, item, tags_json, detail, extracted_at)
       VALUES
       ('ada-lovelace', 'VS Code', '["editor","productivity"]', null, ?),
       ('grace-hopper', 'Vim', '["editor"]', null, ?)`,
      [new Date().toISOString(), new Date().toISOString()],
    );

    const list = await executeTool(toolRegistry, fixture.context, 'categories.list', {});
    expect(list.ok).toBe(true);
    if (list.ok) {
      expect(list.result.rows.some((row: { category: string }) => row.category === 'editor')).toBe(true);
    }

    const rename = await executeTool(toolRegistry, fixture.context, 'categories.rename', {
      fromCategory: 'editor',
      toCategory: 'text-editor',
    });
    expect(rename.ok).toBe(true);

    const get = await executeTool(toolRegistry, fixture.context, 'categories.get', {
      category: 'text-editor',
    });
    expect(get.ok).toBe(true);

    await fixture.cleanup();
  });
});
