import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { openTestDatabase } from '{{alias.platform}}/database/open-test-database{{alias.ext}}';

/**
 * The global setup of the test runs (vitest.config.ts, vitest.e2e.config.ts): names a file for the
 * template database, then opens the database of the tests once, which starts PostgreSQL in process,
 * creates the tables and saves them there. Each spec of the run then opens a copy of that template
 * instead of starting and creating its own. What it resolves is the teardown, which deletes it.
 */
export async function setup(): Promise<() => Promise<void>> {
  const directory = await mkdtemp(path.join(tmpdir(), 'test-database-'));

  process.env['TEST_DATABASE_TEMPLATE'] = path.join(directory, 'template.tar');
  await (await openTestDatabase()).close();

  return () => rm(directory, { recursive: true, force: true });
}
