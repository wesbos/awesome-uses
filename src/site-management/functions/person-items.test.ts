import { describe, expect, it } from 'vitest';
import { executeTool, toolRegistry } from '..';
import { createSiteManagementFixture } from '../test-utils';

describe('personItems tools', () => {
  it('creates and updates person item rows', async () => {
    const fixture = await createSiteManagementFixture();

    const created = await executeTool(toolRegistry, fixture.context, 'personItems.create', {
      personSlug: 'ada-lovelace',
      item: 'VS Code',
      tags: ['editor'],
      detail: 'With extensions',
    });
    expect(created.ok).toBe(true);

    const updated = await executeTool(toolRegistry, fixture.context, 'personItems.update', {
      personSlug: 'ada-lovelace',
      item: 'VS Code',
      patch: {
        tags: ['editor', 'productivity'],
        nextItemName: 'Visual Studio Code',
      },
    });
    expect(updated.ok).toBe(true);

    const fetched = await executeTool(toolRegistry, fixture.context, 'personItems.get', {
      personSlug: 'ada-lovelace',
      item: 'Visual Studio Code',
    });
    expect(fetched.ok).toBe(true);
    if (fetched.ok) {
      expect(fetched.result.tags).toEqual(['editor', 'productivity']);
    }

    await fixture.cleanup();
  });
});
