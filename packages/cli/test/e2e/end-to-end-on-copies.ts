import fs from 'node:fs';
import path from 'node:path';
import pg from 'pg';
import { read, write } from '../helpers';
import { findingsOf, runIn } from './run-in';

export type Runner = 'vitest' | 'jest';

const SPECS = ['first', 'second', 'third'].map((name) => `test/e2e/${name}-copy.e2e.spec.ts`);

/** Where each spec file writes the time it held its copy of the database, one line per file. */
const HELD = 'copies-held.log';

/** What a spec file imports its hooks and its assertions from, under each runner. */
const GLOBALS: Readonly<Record<Runner, string>> = { vitest: 'vitest', jest: '@jest/globals' };

/** How each runner says that the three files passed. */
const THREE_PASSED: Readonly<Record<Runner, RegExp>> = {
  vitest: /Test Files\s+3 passed/g,
  jest: /Test Suites:\s+3 passed/g,
};

/** A megabyte of rows, in rows of about 300 bytes. */
const ROWS_PER_MEGABYTE = 3600;

/**
 * A spec file of the generated project: it starts the application on the server, empties its
 * tables, waits for what it stored to be relayed, finds on the server the copy of the migrated
 * database it runs on, none of which holds the rows of the migrated one, and holds it for a second
 * and a half, so that the files of two runs overlap.
 */
const specOf = (runner: Runner): string => `import { appendFileSync } from 'node:fs';
import pg from 'pg';
import { afterAll, beforeAll, expect, it } from '${GLOBALS[runner]}';
import { startApplication, type RunningApplication } from '$test/e2e/support/start-application';

let application: RunningApplication;
let from = 0;

beforeAll(async () => {
  application = await startApplication();
  from = Date.now();
});

afterAll(async () => {
  appendFileSync(process.env['COPIES_HELD'] ?? '', from + ' ' + Date.now() + '\\n');
  await application.close();
});

async function copies(where = 'true'): Promise<number> {
  const server = new pg.Client({ connectionString: process.env['COPIES_SERVER'] });

  await server.connect();

  const { rows } = await server.query('select 1 from pg_database where datname like $1 and ' + where, [
    process.env['COPIES_LIKE'],
  ]);

  await server.end();

  return rows.length;
}

it('runs on a copy of the migrated database, without the rows it holds', async () => {
  await application.reset();
  await application.settled();

  expect(await copies()).toBeGreaterThanOrEqual(1);
  // The template of a run that starts meanwhile holds the rows until that run has emptied it: the databases of the files never do.
  expect(await copies("datname not like '%template' and pg_database_size(datname) > 40 * 1024 * 1024")).toBe(0);
  await new Promise((resolve) => setTimeout(resolve, 1500));
});
`;

export interface TwoRuns {
  /** What both runs printed. */
  readonly printed: string;
  /** How many of the two runs passed their three files. */
  readonly passed: number;
  /** The most spec files that held a copy of the database at the same moment. */
  readonly together: number;
  /** What a third run printed when it was told that the server had one connection left for it. */
  readonly refused: string;
  /** What a fourth run printed when it failed: 19 workers asked for, 9 connections allowed, which its three files take. */
  readonly unfit: string;
}

/** What `like` matches the copies of `database` with: an underscore is a wildcard unless escaped. */
export function copiesLike(database: string): string {
  return `${database}_test_%`.replaceAll('_', '\\_');
}

/**
 * Runs the end-to-end specs of the project twice at the same time on the migrated `database` of
 * `server`, three files each; a run that fails throws. Then once more with one connection allowed,
 * which is refused before any file starts, and once with nine and 19 workers, which its three files fit in. The migrated database holds 80 MB of rows an application
 * left meanwhile, in a table of their own, removed with the spec files: they are the proof, not
 * part of the project.
 */
export async function runEndToEndTwiceAtOnce(
  root: string,
  server: string,
  database: string,
  runner: Runner,
): Promise<TwoRuns> {
  const rows = `select repeat(md5(g::text), 8) as note from generate_series(1, ${80 * ROWS_PER_MEGABYTE}) g`;

  for (const spec of SPECS) {
    write(root, spec, specOf(runner));
  }

  write(root, HELD, '');

  const run = 'npm run test:e2e';

  const twice = [
    `${run} > first.log 2>&1 & first=$!`,
    `${run} > second.log 2>&1 & second=$!`,
    'wait $first; one=$?; wait $second; two=$?',
    'cat first.log second.log; rm first.log second.log',
    'exit $((one + two))',
  ].join('\n');

  const env = {
    DATABASE_URL: `${server}/${database}`,
    COPIES_SERVER: `${server}/postgres`,
    COPIES_LIKE: copiesLike(database),
    COPIES_HELD: path.join(root, HELD),
  };

  try {
    await onDatabase(`${server}/${database}`, `create table left_by_an_application as ${rows}`);

    const printed = runIn(root, { command: 'sh', args: ['-c', twice], env });

    return {
      printed,
      passed: printed.match(THREE_PASSED[runner])?.length ?? 0,
      together: mostTogether(read(root, HELD)),
      refused: findingsOf(root, { command: 'sh', args: ['-c', run], env: { ...env, TEST_DATABASE_CONNECTIONS: '1' } }),
      unfit: findingsOf(root, {
        command: 'sh',
        args: ['-c', `${run} -- --maxWorkers=19`],
        env: { ...env, TEST_DATABASE_CONNECTIONS: '9' },
      }),
    };
  } finally {
    await onDatabase(`${server}/${database}`, 'drop table if exists left_by_an_application');

    for (const file of [...SPECS, HELD]) {
      fs.rmSync(path.join(root, file));
    }
  }
}

async function onDatabase(url: string, statement: string): Promise<void> {
  const client = new pg.Client({ connectionString: url });

  await client.connect();
  await client.query(statement);
  await client.end();
}

/** The largest number of the logged spans, `<from> <to>` per line, that contain one same moment. */
function mostTogether(held: string): number {
  const spans = held
    .trim()
    .split('\n')
    .map((line) => line.split(' ').map(Number));

  const containing = (moment: number): number =>
    spans.filter(([from = 0, to = 0]) => from <= moment && moment <= to).length;

  return Math.max(...spans.map(([from = 0]) => containing(from)));
}
