import { randomBytes } from 'node:crypto';
import { openRun } from './test-database-run{{alias.sibling}}';
import {
  codeOf,
  copying,
  dropping,
  lostDatabases,
  nameOf,
  NO_SUCH_DATABASE,
  oneAtATime,
  onServer,
  POOL_SIZE,
  RUN_TEMPLATE,
  runOf,
  urlOf,
} from './test-database-server{{alias.sibling}}';

/** A database of its own for one caller, on the server it was given. */
export interface DatabaseClone {
  readonly url: string;

  /** The connections the application of the caller may open: its share of what the server has left, so that every file of a run fits. */
  readonly poolSize: number;

  /** Drops the database, whoever is still connected to it. */
  drop(): Promise<void>;
}

/** The pool of a file that is a run of its own: nothing shares the connections of the server between such runs, so each takes few. */
const POOL_OF_ITS_OWN = 4;

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

  await onServer(url, (server) => oneAtATime(server, run, () => server.query(copying(template, name)))).catch(
    (error: unknown) => {
      throw codeOf(error) === NO_SUCH_DATABASE ? new Error(lostDatabases(template), { cause: error }) : error;
    },
  );

  return {
    url: urlOf(url, name),
    poolSize: Number(process.env[POOL_SIZE]),
    drop: () => onServer(url, (server) => server.query(dropping(name))),
  };
}

/**
 * The template of a run of one file is the database of that file. Nothing counts the files that
 * do this at the same time, each one a run that sees the connections left when it starts: each
 * takes a small pool, and the session of its lock.
 */
async function runOfItsOwn(url: string): Promise<DatabaseClone> {
  const run = await openRun(url, 1);

  return { url: urlOf(url, run.template), poolSize: Math.min(run.poolSize, POOL_OF_ITS_OWN), drop: run.end };
}
