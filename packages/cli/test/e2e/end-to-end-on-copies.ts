import fs from 'node:fs';
import path from 'node:path';
import { read, write } from '../helpers';
import { runIn } from './run-in';

const SPECS = ['first', 'second', 'third'].map((name) => `test/e2e/${name}-copy.e2e.spec.ts`);

/** Where each spec file writes the time it held its copy of the database, one line per file. */
const HELD = 'copies-held.log';

/**
 * A spec file of the generated project: it starts the application on the server, empties its
 * tables, waits for what it stored to be relayed, finds on the server the copy of the migrated
 * database it runs on, and holds it for a second and a half, so that the files of two runs overlap.
 */
const SPEC = `import { appendFileSync } from 'node:fs';
import pg from 'pg';
import { afterAll, beforeAll, expect, it } from 'vitest';
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

async function copies(): Promise<number> {
  const server = new pg.Client({ connectionString: process.env['COPIES_SERVER'] });

  await server.connect();

  const { rows } = await server.query('select 1 from pg_database where datname like $1', [process.env['COPIES_LIKE']]);

  await server.end();

  return rows.length;
}

it('runs on a copy of the migrated database', async () => {
  await application.reset();
  await application.settled();

  expect(await copies()).toBeGreaterThanOrEqual(1);
  await new Promise((resolve) => setTimeout(resolve, 1500));
});
`;

export interface TwoRuns {
  /** What both runs printed. */
  readonly printed: string;
  /** The most spec files that held a copy of the database at the same moment. */
  readonly together: number;
}

/** What `like` matches the copies of `database` with: an underscore is a wildcard unless escaped. */
export function copiesLike(database: string): string {
  return `${database}_test_%`.replaceAll('_', '\\_');
}

/**
 * Runs the end-to-end specs of the project twice at the same time on the migrated `database` of
 * `server`, three files each; a run that fails throws. The spec files are removed: they are the
 * proof, not part of the project.
 */
export function runEndToEndTwiceAtOnce(root: string, server: string, database: string): TwoRuns {
  for (const spec of SPECS) {
    write(root, spec, SPEC);
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
    return {
      printed: runIn(root, { command: 'sh', args: ['-c', twice], env }),
      together: mostTogether(read(root, HELD)),
    };
  } finally {
    for (const file of [...SPECS, HELD]) {
      fs.rmSync(path.join(root, file));
    }
  }
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
