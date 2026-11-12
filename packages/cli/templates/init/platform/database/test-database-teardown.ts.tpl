import { rm } from 'node:fs/promises';
import path from 'node:path';

/**
 * The global teardown of the test runs (`globalTeardown` of jest.config.js): deletes the cluster
 * test-database-template.ts saved, or ends the run test-database-run.ts started on a server, which
 * left its end where this file finds it without importing anything of the project.
 */
export default async function teardown(): Promise<void> {
  const file = process.env['TEST_DATABASE_TEMPLATE'];
  const end: unknown = Reflect.get(globalThis, Symbol.for('ddd-ts-kit.test-database-run'));

  if (file !== undefined) {
    await rm(path.dirname(file), { recursive: true, force: true });
  }

  if (typeof end === 'function') {
    await Reflect.apply(end, undefined, []);
  }
}
