{{#if tests.vitest}}
import type { TestProject } from 'vitest/node';
import { openRun } from './test-database-run{{alias.sibling}}';
import { POOL_SIZE, RUN_TEMPLATE } from './test-database-server{{alias.sibling}}';

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

  const run = await openRun(url, filesAtOnce(project));

  process.env[RUN_TEMPLATE] = run.template;
  process.env[POOL_SIZE] = String(run.poolSize);

  return run.end;
}

/**
 * As many files at once as the run has workers, and no more than the files of this run, as the
 * runner lists them once the filters of the command line are applied: 3 files never need the
 * connections of 16 workers. A shard runs its share of them, rounded up. While it watches, a run
 * may be handed a file written later, and a list that is empty says nothing: the workers alone count.
 */
function filesAtOnce(project: TestProject): number {
  const { maxWorkers, watch, shard } = project.vitest.config;
  const listed = project.vitest.state.getPaths().length;
  const files = watch || listed === 0 ? maxWorkers : Math.ceil(listed / (shard?.count ?? 1));

  return Math.max(1, Math.min(maxWorkers, files));
}
{{/if}}
{{#if tests.jest}}
import { readdirSync } from 'node:fs';
import path from 'node:path';
import { openRun } from './test-database-run{{alias.sibling}}';
import { POOL_SIZE, RUN_TEMPLATE } from './test-database-server{{alias.sibling}}';
import saveCluster from './test-database-template{{alias.sibling}}';

/** What Jest hands a global setup, as far as this one reads it: the run, then the project. */
interface JestRun {
  readonly maxWorkers: number;
  readonly rootDir: string;
  readonly shard?: { readonly shardCount: number };
  readonly testPathPatterns: { readonly patterns: readonly string[] };
}

interface JestProject {
  readonly testPathIgnorePatterns: readonly string[];
}

/** The spec files jest.e2e.config.js matches. */
const SPEC = /\.(?:e2e|acceptance)\.spec\.ts$/;
/** Where the end of the run waits for test-database-teardown.ts, which the unit run loads too and which imports nothing. */
const END = Symbol.for('ddd-ts-kit.test-database-run');

/**
 * The global setup of the end-to-end run (jest.e2e.config.js). With DATABASE_URL the files run on
 * that server, and what takes time there is done here, once, where no timeout of a hook applies
 * (test-database-run.ts); without it they run on PostgreSQL in process, saved once as in the unit
 * run. Jest loads a global setup, and what it imports, with the resolution of Node, which knows no
 * alias of the project: the files of test/support/ import one another by a relative path.
 */
export default async function setup(jest: JestRun, project: JestProject): Promise<void> {
  const url = process.env['DATABASE_URL'] ?? '';

  if (url === '') {
    await saveCluster();

    return;
  }

  const run = await openRun(url, filesAtOnce(jest, project));

  process.env[RUN_TEMPLATE] = run.template;
  process.env[POOL_SIZE] = String(run.poolSize);
  Reflect.set(globalThis, END, run.end);
}

/**
 * As many files at once as the run has workers, and no more than the files of this run: 3 files
 * never need the connections of 16 workers. Jest does not hand its list to a global setup: the
 * count is one it cannot exceed, and the workers alone count when it cannot be made.
 */
function filesAtOnce(jest: JestRun, project: JestProject): number {
  try {
    const files = Math.ceil(specFiles(jest, project).length / (jest.shard?.shardCount ?? 1));

    return Math.max(1, Math.min(jest.maxWorkers, files));
  } catch {
    return jest.maxWorkers;
  }
}

/**
 * The spec files under test/ that Jest may run: those a pattern of the command line matches, on
 * the path from the root of the project or on the whole path as Jest does, when there is one, less
 * those the configuration ignores.
 */
function specFiles({ rootDir, testPathPatterns }: JestRun, { testPathIgnorePatterns }: JestProject): string[] {
  const asked = testPathPatterns.patterns.map((pattern) => new RegExp(pattern.replace(/^\.[/\\]/, '^'), 'i'));
  const ignored = testPathIgnorePatterns.map((pattern) => new RegExp(pattern));
  const whole = (file: string): string => path.join(rootDir, file);

  return readdirSync(path.join(rootDir, 'test'), { recursive: true, encoding: 'utf8' })
    .map((file) => path.join('test', file))
    .filter((file) => SPEC.test(file) && !ignored.some((pattern) => pattern.test(whole(file))))
    .filter((file) => asked.length === 0 || asked.some((pattern) => pattern.test(file) || pattern.test(whole(file))));
}
{{/if}}
