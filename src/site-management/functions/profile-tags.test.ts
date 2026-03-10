import { describe, expect, it } from 'vitest';
import { executeTool, toolRegistry } from '..';
import { createSiteManagementFixture } from '../test-utils';

describe('profileTags tools', () => {
  it('lists profile tags', async () => {
    const fixture = await createSiteManagementFixture();

    const list = await executeTool(toolRegistry, fixture.context, 'profileTags.list', {});
    expect(list.ok).toBe(true);
    if (list.ok) {
      const payload = list.result as { total: number; rows: Array<{ tag: string; count: number }> };
      expect(payload.total).toBeGreaterThan(0);
      expect(payload.rows.some((row) => row.tag === 'TypeScript')).toBe(true);
    }

    await fixture.cleanup();
  });
});
