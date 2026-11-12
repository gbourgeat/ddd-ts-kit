import pg from 'pg';
import { afterEach, describe, expect, it } from 'vitest';
import {
  databasesLike,
  endRuns,
  hand,
  migrated,
  migratedByALimitedRole,
  SERVER,
  support,
  urlOf,
} from './run-on-a-server';
import { SLOW } from './stacks';

const ON_A_SERVER = SLOW && SERVER !== '';

/** How a refusal ends its count of what the server leaves. */
const OF_THE_SERVER = String.raw`the server leaves (\d+) \(max_connections \d+, \d+ reserved, \d+ open\)`;

/**
 * Slow, opt-in (DDD_TS_KIT_E2E=1 and DDD_TS_KIT_MIGRATIONS_SERVER): the connections of an end-to-end
 * run of a generated project on a server that has few left, on a real PostgreSQL. The run is given
 * the number of files that run at once, as its global setup counts it from the workers and the spec
 * files of the run.
 */
describe.runIf(ON_A_SERVER)('the connections of an end-to-end run, on a real PostgreSQL', { timeout: 120_000 }, () => {
  afterEach(endRuns);

  it('are what the role has left, shared between the files, one to spare each: a file fills its pool and opens a client of its own', async () => {
    const { openRun, cloneDatabase } = await support();
    const url = await migratedByALimitedRole('copies_limited', 13);

    hand(await openRun(url, 4));

    const files = await Promise.all([1, 2, 3, 4].map(() => cloneDatabase(url)));

    expect(files.map((file) => file.poolSize)).toEqual([2, 2, 2, 2]);

    // Every file fills its pool and opens one more connection at the same moment: the server refuses nobody.
    const pools = files.map((file) => new pg.Pool({ connectionString: file.url, max: file.poolSize }));
    const spared = files.map((file) => new pg.Pool({ connectionString: file.url, max: 1 }));
    const queries = [...pools, ...spared].flatMap((pool) => [1, 2, 3, 4].map(() => pool.query('select pg_sleep(0.3)')));

    await expect(Promise.all(queries)).resolves.toHaveLength(32);
    await Promise.all([...pools, ...spared].map((pool) => pool.end()));
  });

  it('refuse a run that does not fit before any file starts, with its numbers and what raises the bound that holds it', async () => {
    const { openRun } = await support();
    const url = await migratedByALimitedRole('copies_limited', 13);

    await expect(openRun(url, 8)).rejects.toThrow(
      '8 spec files at once need 24 connections (2 for each application at least and 1 to spare), and the role copies_limited has 12 left (connection limit 13, 1 open): run at most 4 at once (pnpm run test:e2e --maxWorkers=4), or raise the limit of the role (alter role copies_limited connection limit <more>).',
    );

    expect(await databasesLike('copies_limited_test_')).toEqual([]);

    await expect(openRun(urlOf('copies_limited'), 5000)).rejects.toThrow(
      new RegExp(
        `^5000 spec files at once need 15000 connections .*, and ${OF_THE_SERVER}: run at most \\d+ at once .*, or raise max_connections\\.$`,
      ),
    );
  });

  it('never refuse a run whose files fit, however many workers the machine would give it', async () => {
    const { openRun } = await support();
    const url = await migratedByALimitedRole('copies_limited', 13);

    // 3 spec files on a machine of 19 workers: the global setup counts 3 at once, which 12 connections take.
    await expect(openRun(url, 19)).rejects.toThrow('19 spec files at once need 57 connections');
    expect((await openRun(url, 3)).poolSize).toBe(3);
  });
});

describe.runIf(ON_A_SERVER)('what TEST_DATABASE_CONNECTIONS states, on a real PostgreSQL', { timeout: 120_000 }, () => {
  afterEach(endRuns);

  it('bounds the run under what the server leaves, and is what a refusal says to raise', async () => {
    const { openRun } = await support();
    const url = urlOf('copies_stated');

    await migrated('copies_stated');
    process.env['TEST_DATABASE_CONNECTIONS'] = '5';

    await expect(openRun(url, 2)).rejects.toThrow(
      /^2 spec files at once need 6 connections \(2 for each application at least and 1 to spare\), and TEST_DATABASE_CONNECTIONS allows 5: run at most 1 at once \(pnpm run test:e2e --maxWorkers=1\), or state more in TEST_DATABASE_CONNECTIONS \(\d+ at most\)\.$/,
    );

    process.env['TEST_DATABASE_CONNECTIONS'] = '9';

    expect((await openRun(url, 2)).poolSize).toBe(3);
  });

  it.each([['abc'], ['0'], ['2.5'], ['-3']])(
    'is refused with a sentence when it is "%s", not a whole number of connections',
    async (stated) => {
      const { openRun } = await support();

      await migrated('copies_stated');
      process.env['TEST_DATABASE_CONNECTIONS'] = stated;

      await expect(openRun(urlOf('copies_stated'), 2)).rejects.toThrow(
        `TEST_DATABASE_CONNECTIONS is "${stated}": state a whole number of connections, 1 or more, or leave it unset.`,
      );
    },
  );

  it('is refused when it states more than the server leaves, with what the server leaves', async () => {
    const { openRun } = await support();

    await migrated('copies_stated');
    process.env['TEST_DATABASE_CONNECTIONS'] = '100000';

    await expect(openRun(urlOf('copies_stated'), 2)).rejects.toThrow(
      new RegExp(
        `^TEST_DATABASE_CONNECTIONS states 100000 connections, and ${OF_THE_SERVER}: state \\1 at most, or leave it unset\\.$`,
      ),
    );
  });
});
