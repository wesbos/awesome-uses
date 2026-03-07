import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { createSiteManagementFixture } from './test-utils';
import { createToolRegistry, defineTool } from './registry';
import { executeTool } from './executor';

describe('executeTool', () => {
  it('executes registered tools with validated input', async () => {
    const fixture = await createSiteManagementFixture();
    const registry = createToolRegistry([
      defineTool({
        name: 'demo.echo',
        scope: 'people',
        description: 'Echo tool',
        inputSchema: z.object({ value: z.string() }),
        handler: async (_context, input) => ({ echoed: input.value }),
      }),
    ]);

    const result = await executeTool(registry, fixture.context, 'demo.echo', {
      value: 'hello',
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.result).toEqual({ echoed: 'hello' });
    }
    await fixture.cleanup();
  });

  it('returns validation errors for invalid payloads', async () => {
    const fixture = await createSiteManagementFixture();
    const registry = createToolRegistry([
      defineTool({
        name: 'demo.echo',
        scope: 'people',
        description: 'Echo tool',
        inputSchema: z.object({ value: z.string() }),
        handler: (_context, input) => ({ echoed: input.value }),
      }),
    ]);

    const result = await executeTool(registry, fixture.context, 'demo.echo', {
      value: 123,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('VALIDATION_ERROR');
    }
    await fixture.cleanup();
  });
});
