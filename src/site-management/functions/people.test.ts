import { describe, expect, it } from 'vitest';
import { executeTool, toolRegistry } from '..';
import { createSiteManagementFixture } from '../test-utils';

describe('people tools', () => {
  it('creates, updates, and deletes people', async () => {
    const fixture = await createSiteManagementFixture();

    const createResult = await executeTool(toolRegistry, fixture.context, 'people.create', {
      person: {
        name: 'New Person',
        description: 'Test',
        url: 'https://new.dev/uses',
        country: '🇨🇦',
        tags: ['React'],
      },
    });
    expect(createResult.ok).toBe(true);

    const listResult = await executeTool(toolRegistry, fixture.context, 'people.list', {
      limit: 20,
      offset: 0,
    });
    expect(listResult.ok).toBe(true);
    if (!listResult.ok) {
      throw new Error('Expected listResult.ok to be true');
    }
    const payload = listResult.result as {
      rows: Array<{ name: string; personSlug: string }>;
    };
    const created = payload.rows.find((row) => row.name === 'New Person');
    expect(created).toBeTruthy();
    if (!created) {
      throw new Error('Expected created person to exist.');
    }

    const updateResult = await executeTool(toolRegistry, fixture.context, 'people.update', {
      personSlug: created.personSlug,
      patch: { description: 'Updated', tags: ['TypeScript'] },
    });
    expect(updateResult.ok).toBe(true);

    const deleteResult = await executeTool(toolRegistry, fixture.context, 'people.delete', {
      personSlug: created.personSlug,
    });
    expect(deleteResult.ok).toBe(true);

    await fixture.cleanup();
  });
});
