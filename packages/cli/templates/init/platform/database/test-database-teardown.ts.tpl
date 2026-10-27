import { rm } from 'node:fs/promises';
import path from 'node:path';

/** The global teardown of the test runs (`globalTeardown` of jest.config.js): deletes the cluster test-database-template.ts saved. */
export default async function teardown(): Promise<void> {
  const file = process.env['TEST_DATABASE_TEMPLATE'];

  if (file !== undefined) {
    await rm(path.dirname(file), { recursive: true, force: true });
  }
}
