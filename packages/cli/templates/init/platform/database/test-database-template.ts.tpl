import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { PGlite } from '@electric-sql/pglite';

/**
 * The global setup of the test runs (vitest.config.ts, vitest.e2e.config.ts): starts PostgreSQL in
 * process once and saves its initialised cluster to a file. Each spec of the run opens a copy of it
 * (open-test-database.ts) instead of running an initdb of its own, the slow part of starting, then
 * creates its tables there, so that what creates them stays run and measured in every spec. What it
 * resolves is the teardown, which deletes the file.
 */
export async function setup(): Promise<() => Promise<void>> {
  const directory = await mkdtemp(path.join(tmpdir(), 'test-database-'));
  const file = path.join(directory, 'cluster.tar');
  const engine = await PGlite.create();

  await writeFile(file, new Uint8Array(await (await engine.dumpDataDir('none')).arrayBuffer()));
  await engine.close();
  process.env['TEST_DATABASE_TEMPLATE'] = file;

  return () => rm(directory, { recursive: true, force: true });
}
