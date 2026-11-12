import { randomBytes } from 'node:crypto';
import type pg from 'pg';
import {
  connectedTo,
  copying,
  dropping,
  nameOf,
  oneAtATime,
  POOL_SIZE,
  RUN_TEMPLATE,
  runOf,
  urlOf,
} from '{{alias.test}}/support/test-database-run{{alias.ext}}';

/** The database of one spec file, on the server the run was given. */
export interface DatabaseClone {
  readonly url: string;

  /** The connections the application of the file may open: its share of what the server has left, so that every file of the run fits. */
  readonly poolSize: number;

  /** Drops the database, whoever is still connected to it. */
  drop(): Promise<void>;
}

/**
 * A database for one spec file: a copy of the template of the run (`create database ... template`),
 * which the global setup made from the migrated database `url` names and emptied
 * (test-database-run.ts). The copy holds the tables and no row, so it takes a fraction of a second
 * whatever the migrated database holds, one copy at a time in a run. Files run at the same time on
 * one server, two runs at once never wait for each other, and nothing a file stores reaches
 * another. The copy is dropped when its file closes it, or when the run ends.
 */
export async function cloneDatabase(url: string): Promise<DatabaseClone> {
  const template = process.env[RUN_TEMPLATE] ?? '';
  const run = runOf(template, url);

  if (run === undefined) {
    throw new Error(
      'The run has no copy of the database of DATABASE_URL for this file to copy: test/support/test-database-run.ts did not run on it. The configuration of the end-to-end run names that file as a global setup.',
    );
  }

  const name = nameOf(url, run, randomBytes(4).toString('hex'));

  await onServer(url, (server) => oneAtATime(server, run, () => server.query(copying(template, name))));

  return {
    url: urlOf(url, name),
    poolSize: Number(process.env[POOL_SIZE]),
    drop: () => onServer(url, (server) => server.query(dropping(name))),
  };
}

/**
 * Runs `work` on a connection of its own to the maintenance database of the server: the copy of a
 * file, or its drop, the one connection a file holds besides its pool, and never at the same time.
 */
async function onServer(url: string, work: (server: pg.Client) => Promise<unknown>): Promise<void> {
  const server = await connectedTo(url);

  try {
    await work(server);
  } finally {
    await server.end();
  }
}
