import { describe, expect, it } from 'vite-plus/test';
import * as schema from '../../server/schema';
import { executeTool, toolRegistry } from '..';
import { createSiteManagementFixture } from '../test-utils';

describe('tag tools', () => {
  it('lists and renames extracted tags', async () => {
    const fixture = await createSiteManagementFixture();
    const extractedAt = new Date().toISOString();
    fixture.context.db.insert(schema.personItems).values([
      { personSlug: 'ada-lovelace', item: 'VS Code', tagsJson: '["editor","productivity"]', extractedAt },
      { personSlug: 'grace-hopper', item: 'Vim', tagsJson: '["editor"]', extractedAt },
    ]).run();

    const list = await executeTool(toolRegistry, fixture.context, 'tags.list', {});
    expect(list.ok).toBe(true);
    if (list.ok) {
      const payload = list.result as { rows: Array<{ tag: string }> };
      expect(payload.rows.some((row) => row.tag === 'editor')).toBe(true);
    }

    const rename = await executeTool(toolRegistry, fixture.context, 'tags.rename', {
      fromTag: 'editor',
      toTag: 'text-editor',
    });
    expect(rename.ok).toBe(true);

    const get = await executeTool(toolRegistry, fixture.context, 'tags.get', {
      tag: 'text-editor',
    });
    expect(get.ok).toBe(true);

    await fixture.cleanup();
  });
});
