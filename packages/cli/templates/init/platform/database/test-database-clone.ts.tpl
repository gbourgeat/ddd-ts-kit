import { randomBytes } from 'node:crypto';
import { openRun } from '{{alias.test}}/support/test-database-run{{alias.ext}}';
import {
  copying,
  dropping,
  nameOf,
  oneAtATime,
  onServer,
  POOL_SIZE,
  RUN_TEMPLATE,
  runOf,
  urlOf,
} from '{{alias.test}}/support/test-database-server{{alias.ext}}';

/** A database of its own for one caller, on the server it was given. */
export interface DatabaseClone {
  readonly url: string;

  /** The connections the application of the caller may open: its share of what the server has left, so that every file of a run fits. */
  readonly poolSize: number;

  /** Drops the database, whoever is still connected to it. */
  drop(): Promise<void>;
}

/**
 * A database of its own on the server `url` names: the tables of the migrated database and none
 * of the rows a run empties (test-database-emptying.ts). In an end-to-end run the global setup
 * copied and emptied the migrated database once (test-database-setup.ts), and this copies that
 * template (`create database ... template`), one copy at a time in the run, in a fraction of a
 * second whatever the migrated database holds. Anywhere else (a spec of the unit run, a project
 * with no end-to-end run) nothing started a run: the call is a run of its own, which copies the
 * migrated database itself, in the time that takes. Either way spec files run at the same time on
 * one server and nothing one stores reaches another. The copy is dropped when its caller closes
 * it, at the end of its run, or by a later run when its own was killed.
 */
export async function cloneDatabase(url: string): Promise<DatabaseClone> {
  const template = process.env[RUN_TEMPLATE] ?? '';
  const run = runOf(template, url);

  if (run === undefined) {
    return runOfItsOwn(url);
  }

  const name = nameOf(url, run, randomBytes(4).toString('hex'));

  await onServer(url, (server) => oneAtATime(server, run, () => server.query(copying(template, name))));

  return {
    url: urlOf(url, name),
    poolSize: Number(process.env[POOL_SIZE]),
    drop: () => onServer(url, (server) => server.query(dropping(name))),
  };
}

/** The template of a run of one file is the database of that file: it holds one more session than a file of an end-to-end run, the one of its lock. */
async function runOfItsOwn(url: string): Promise<DatabaseClone> {
  const run = await openRun(url, 1);

  return { url: urlOf(url, run.template), poolSize: run.poolSize, drop: run.end };
}
