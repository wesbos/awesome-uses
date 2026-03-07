import { promisify } from 'node:util';
import { execFile } from 'node:child_process';
import { describe, expect, it } from 'vitest';
import { createSiteManagementFixture } from '../src/site-management/test-utils';

const execFileAsync = promisify(execFile);

describe('site-management CLI', () => {
  it('lists tools and can call a tool', async () => {
    const fixture = await createSiteManagementFixture();
    const env = {
      ...process.env,
      SITE_REPO_ROOT: fixture.root,
      SITE_DATA_FILE_PATH: fixture.dataFilePath,
      SITE_GENERATED_PEOPLE_PATH: fixture.generatedPeoplePath,
      SITE_DB_PATH: fixture.dbPath,
    };

    const list = await execFileAsync(
      'pnpm',
      ['tsx', './scripts/site-management-cli.ts', 'list'],
      {
        cwd: '/workspace',
        env,
      },
    );
    const listJson = JSON.parse(list.stdout) as { ok: boolean; total: number };
    expect(listJson.ok).toBe(true);
    expect(listJson.total).toBeGreaterThan(10);

    const call = await execFileAsync(
      'pnpm',
      [
        'tsx',
        './scripts/site-management-cli.ts',
        'call',
        'people.list',
        '--input',
        JSON.stringify({ limit: 10, offset: 0 }),
      ],
      {
        cwd: '/workspace',
        env,
      },
    );
    const callJson = JSON.parse(call.stdout) as { ok: boolean };
    expect(callJson.ok).toBe(true);

    await fixture.cleanup();
  });
});
