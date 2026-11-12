import { afterEach, describe, expect, it } from 'vitest';
import {
  connected,
  databaseOf,
  databasesLike,
  endRuns,
  migrated,
  migratedByALimitedRole,
  onServer,
  rowsOf,
  SERVER,
  support,
  urlOf,
} from './run-on-a-server';
import { SLOW } from './stacks';

/** The lock a run holds while it lives, as the support takes it: this number and the run. */
const LIVE = 0x64646b74;

/**
 * Slow, opt-in (DDD_TS_KIT_E2E=1 and DDD_TS_KIT_MIGRATIONS_SERVER): what the global setup of an
 * end-to-end run of a generated project drops and what it refuses, on a real PostgreSQL. A run that
 * was killed leaves its databases; another run of the same project may live at the same time, in
 * another checkout or on another machine.
 */
describe.runIf(SLOW && SERVER !== '')('the databases a run left, on a real PostgreSQL', { timeout: 120_000 }, () => {
  afterEach(endRuns);

  it('are dropped by the next run when their run died, and kept for a run that lives, a file that still runs, another name', async () => {
    const { startRun, cloneDatabase } = await support();
    const url = urlOf('left_clean');
    const dead = ['left_clean_test_deadbeef_template', 'left_clean_test_deadbeef_0a0b0c0d'];
    const living = 'left_clean_test_0badcafe_template';
    const stillRunning = 'left_clean_test_feedface_0a0b0c0d';
    const others = ['left_clean_test_data', 'left_clean_test_1794488410_0a0b0c0d'];

    await migrated('left_clean');

    for (const name of [...dead, living, stillRunning, ...others]) {
      await onServer(`drop database if exists ${name} with (force)`);
      await onServer(`create database ${name}`);
    }

    // Another run, on this machine or elsewhere, holds the lock of its name; a file of a run that died is still connected.
    const otherRun = await connected(urlOf('postgres'));
    const file = await connected(urlOf(stillRunning));

    await otherRun.query('select pg_advisory_lock($1, $2)', [LIVE, 0x0badcafe]);

    const end = await startRun(url, 2);
    // A file of this run that fails while it starts never drops its copy.
    const abandoned = await cloneDatabase(url);
    const kept = [living, stillRunning, ...others];

    expect(await databasesLike('left_clean_test_')).toEqual(
      expect.arrayContaining([...kept, databaseOf(abandoned.url)]),
    );

    expect(await databasesLike('left_clean_test_deadbeef')).toEqual([]);

    await end();

    expect(await databasesLike('left_clean_test_')).toEqual([...kept].sort());

    // The other run ended without cleaning and the file closed: the next run drops both.
    await otherRun.end();
    await file.end();
    await (await startRun(url, 2))();

    expect(await databasesLike('left_clean_test_')).toEqual([...others].sort());

    for (const name of others) {
      await onServer(`drop database ${name}`);
    }
  });
});

describe.runIf(SLOW && SERVER !== '')('the global setup of a run, on a real PostgreSQL', { timeout: 120_000 }, () => {
  afterEach(endRuns);

  it('says that somebody is connected to the migrated database, which PostgreSQL then refuses to copy', async () => {
    const { startRun } = await support();

    await migrated('left_busy');

    const session = await connected(urlOf('left_busy'));

    try {
      await expect(startRun(urlOf('left_busy'), 2)).rejects.toThrow(
        'The database "left_busy" has other sessions (an application that runs, a console, a migration): PostgreSQL copies a database only while nobody else is connected to it. Close them, or give the tests a database of their own.',
      );
    } finally {
      await session.end();
    }

    expect(await databasesLike('left_busy_test_')).toEqual([]);
  });

  it('says what to do of tables another role owns, which the run cannot empty', async () => {
    const { startRun } = await support();
    const url = await migratedByALimitedRole('left_limited');

    await rowsOf(urlOf('left_limited'), 'alter table audit.audit_entries owner to app');

    await expect(startRun(url, 2)).rejects.toThrow(
      /^The copy of the database "left_limited" could not be emptied \(error: must be owner of table audit_entries\): the role of DATABASE_URL owns its tables/,
    );

    expect(await databasesLike('left_limited_test_')).toEqual([]);
  });

  it('says to migrate a database that holds no table, to create one that is absent, and where it is named when it did not run', async () => {
    const { startRun, cloneDatabase } = await support();

    await onServer('drop database if exists left_empty with (force)');
    await onServer('create database left_empty');

    await expect(startRun(urlOf('left_empty'), 2)).rejects.toThrow(
      'The database "left_empty" holds no table: migrate it first (pnpm run db:migrate).',
    );

    await expect(startRun(urlOf('left_absent'), 2)).rejects.toThrow(
      'The server of DATABASE_URL has no database "left_absent": create it, then migrate it (pnpm run db:migrate).',
    );

    expect(await databasesLike('left_empty_test_')).toEqual([]);

    delete process.env['TEST_DATABASE_RUN'];

    await expect(cloneDatabase(urlOf('left_empty'))).rejects.toThrow(
      'The run has no copy of the database of DATABASE_URL for this file to copy: test/support/test-database-run.ts did not run on it.',
    );
  });
});
