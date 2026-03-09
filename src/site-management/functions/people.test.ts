import { describe, expect, it } from 'vitest';
import { executeTool, toolRegistry } from '..';
import { createSiteManagementFixture } from '../test-utils';

describe('people tools', () => {
  it('lists and gets people', async () => {
    const fixture = await createSiteManagementFixture();

    const listResult = await executeTool(toolRegistry, fixture.context, 'people.list', {
      limit: 20,
      offset: 0,
    });
    expect(listResult.ok).toBe(true);
    if (!listResult.ok) throw new Error('Expected listResult.ok to be true');

    const payload = listResult.result as {
      total: number;
      rows: Array<{ name: string; personSlug: string }>;
    };
    expect(payload.total).toBe(2);
    expect(payload.rows).toHaveLength(2);

    const getResult = await executeTool(toolRegistry, fixture.context, 'people.get', {
      personSlug: payload.rows[0].personSlug,
    });
    expect(getResult.ok).toBe(true);
    if (!getResult.ok) throw new Error('Expected getResult.ok to be true');

    const person = getResult.result as { name: string; personSlug: string };
    expect(person.personSlug).toBe(payload.rows[0].personSlug);

    await fixture.cleanup();
  });
});
