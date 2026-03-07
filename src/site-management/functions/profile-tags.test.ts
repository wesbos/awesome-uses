import { describe, expect, it } from 'vitest';
import { executeTool, toolRegistry } from '..';
import { createSiteManagementFixture } from '../test-utils';

describe('profileTags tools', () => {
  it('renames and deletes profile tags', async () => {
    const fixture = await createSiteManagementFixture();

    const rename = await executeTool(toolRegistry, fixture.context, 'profileTags.rename', {
      fromTag: 'VS Code',
      toTag: 'Editor',
    });
    expect(rename.ok).toBe(true);

    const deleteResult = await executeTool(toolRegistry, fixture.context, 'profileTags.delete', {
      tag: 'Python',
      replacementTag: 'Programming',
    });
    expect(deleteResult.ok).toBe(true);

    const list = await executeTool(toolRegistry, fixture.context, 'profileTags.list', {});
    expect(list.ok).toBe(true);
    if (list.ok) {
      expect(list.result.rows.some((row: { tag: string }) => row.tag === 'Editor')).toBe(true);
    }

    await fixture.cleanup();
  });
});
