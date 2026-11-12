{{#if tests.vitest}}
import type { TestProject } from 'vitest/node';
import { openRun } from '{{alias.test}}/support/test-database-run{{alias.ext}}';
import { POOL_SIZE, RUN_TEMPLATE } from '{{alias.test}}/support/test-database-server{{alias.ext}}';

/**
 * A global setup of the end-to-end run (vitest.e2e.config.ts), which resolves its teardown. With
 * DATABASE_URL the files run on that server, and what takes time there is done here, once, where no
 * timeout of a hook applies (test-database-run.ts); without it they run on PostgreSQL in process,
 * and nothing is done. The files find the template of the run and their pool in the environment.
 */
export async function setup(project: TestProject): Promise<() => Promise<void>> {
  const url = process.env['DATABASE_URL'] ?? '';

  if (url === '') {
    return () => Promise.resolve();
  }

  const run = await openRun(url, await filesAtOnce(project));

  process.env[RUN_TEMPLATE] = run.template;
  process.env[POOL_SIZE] = String(run.poolSize);

  return run.end;
}

/**
 * As many files at once as the run has workers, and no more than the spec files the configuration
 * matches: 3 files never need the connections of 16 workers. While it watches, a run may be handed
 * a file written later: the workers alone count.
 */
async function filesAtOnce(project: TestProject): Promise<number> {
  const { maxWorkers, watch } = project.config;
  const files = watch ? maxWorkers : (await project.globTestFiles()).testFiles.length;

  return Math.max(1, Math.min(maxWorkers, files));
}
{{/if}}
{{#if tests.jest}}
import { readdirSync } from 'node:fs';
import { openRun } from '{{alias.test}}/support/test-database-run{{alias.ext}}';
import { POOL_SIZE, RUN_TEMPLATE } from '{{alias.test}}/support/test-database-server{{alias.ext}}';
import saveCluster from '{{alias.test}}/support/test-database-template{{alias.ext}}';

/** What Jest hands a global setup, as far as this one reads it. */
interface JestRun {
  readonly maxWorkers: number;
  readonly rootDir: string;
  readonly testPathPatterns: { readonly patterns: readonly string[] };
}

/** The spec files jest.e2e.config.js matches. */
const SPEC = /\.(?:e2e|acceptance)\.spec\.ts$/;
/** Where the end of the run waits for test-database-teardown.ts, which the unit run loads too and which imports nothing. */
const END = Symbol.for('ddd-ts-kit.test-database-run');

/**
 * The global setup of the end-to-end run (jest.e2e.config.js). With DATABASE_URL the files run on
 * that server, and what takes time there is done here, once, where no timeout of a hook applies
 * (test-database-run.ts); without it they run on PostgreSQL in process, saved once as in the unit
 * run. Jest loads a global setup with the resolution of Node, which knows no alias of the project:
 * the scripts of the end-to-end run start Jest under tsx (`--import tsx`), which resolves them.
 */
export default async function setup(jest: JestRun): Promise<void> {
  const url = process.env['DATABASE_URL'] ?? '';

  if (url === '') {
    await saveCluster();

    return;
  }

  const run = await openRun(url, filesAtOnce(jest));

  process.env[RUN_TEMPLATE] = run.template;
  process.env[POOL_SIZE] = String(run.poolSize);
  Reflect.set(globalThis, END, run.end);
}

/**
 * As many files at once as the run has workers, and no more than the spec files under test/ that
 * the patterns of the command line match: 3 files never need the connections of 16 workers.
 */
function filesAtOnce({ maxWorkers, rootDir, testPathPatterns }: JestRun): number {
  const asked = testPathPatterns.patterns.map((pattern) => new RegExp(pattern, 'i'));

  const files = readdirSync(rootDir + '/test', { recursive: true, encoding: 'utf8' })
    .filter((file) => SPEC.test(file))
    .filter((file) => asked.length === 0 || asked.some((pattern) => pattern.test(rootDir + '/test/' + file)));

  return Math.max(1, Math.min(maxWorkers, files.length));
}
{{/if}}
