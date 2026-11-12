import type pg from 'pg';
import { poolSizeFor } from '{{alias.test}}/support/test-database-budget{{alias.ext}}';
import { emptied, type Emptied } from '{{alias.test}}/support/test-database-emptying{{alias.ext}}';
import { dropLeftovers } from '{{alias.test}}/support/test-database-leftovers{{alias.ext}}';
import {
  codeOf,
  copying,
  databaseOf,
  dropping,
  nameOf,
  oneAtATime,
  onServer,
  runOf,
  TEMPLATE,
} from '{{alias.test}}/support/test-database-server{{alias.ext}}';
import { openSession, type RunSession } from '{{alias.test}}/support/test-database-session{{alias.ext}}';

/** A run on a server: the template its files copy, the pool of each, and its end. */
export interface Run {
  readonly template: string;
  readonly poolSize: number;

  /** Drops the template and what the files of the run did not drop, then lets the lock go. Never throws. */
  end(): Promise<void>;
}

/** A migrated database holds a few megabytes: beyond this it holds rows, and the run says what copying them costs. */
const LARGE = 64 * 1024 * 1024;
/** How many of the tables a line names before it counts the others. */
const NAMED = 5;
/** The SQLSTATE of a server that refuses to copy a database other sessions are connected to. */
const OTHER_SESSIONS = '55006';

const REFUSALS: Readonly<Record<string, (database: string) => string>> = {
  [OTHER_SESSIONS]: (database) =>
    `The database "${database}" has other sessions (an application that runs, a console, a migration): PostgreSQL copies a database only while nobody else is connected to it. Close them, or give the tests a database of their own.`,
  '42501': (database) =>
    `The role of DATABASE_URL may not copy the database "${database}", and each spec file runs on a copy of it: the role creates databases (alter role <role> createdb) and owns that one (alter database "${database}" owner to <role>).`,
  '3D000': (database) =>
    `The server of DATABASE_URL has no database "${database}": create it, then migrate it (npm run db:migrate).`,
};

/**
 * Starts a run on the server `url` names, in which `atOnce` spec files run at the same time: takes
 * the lock that says it lives, drops what the runs that died left, refuses a run the connections
 * of the server cannot take, then copies the migrated database, one run at a time on the server,
 * and empties the copy. The global setup of the end-to-end run calls it once, where no timeout of
 * a hook applies (test-database-setup.ts), and each file copies the template in a fraction of a
 * second (test-database-clone.ts). What the run has to say goes to `tell`, the error output.
 */
export async function openRun(url: string, atOnce: number, tell = toErrorOutput): Promise<Run> {
  const session = await openSession(url, tell);
  const template = nameOf(url, session.id, TEMPLATE);
  const end = (): Promise<void> => ended(session, url);

  try {
    await dropLeftovers(session.server(), url, session.id);

    const poolSize = await poolSizeFor(session.server(), atOnce);
    const from = Date.now();

    await oneAtATime(session.server(), '0', () => copied(session.server(), databaseOf(url), template));
    await session.beatOn(template);
    tell(said(await emptied(url, template), databaseOf(url), Math.ceil((Date.now() - from) / 1000)));

    return { template, poolSize, end };
  } catch (error) {
    await end();

    throw error;
  }
}

function toErrorOutput(line: string): void {
  process.stderr.write(line);
}

/** On the session of the run, or on another one when the server ended that one; what cannot be dropped now goes with a later run. */
async function ended(session: RunSession, url: string): Promise<void> {
  const dropOwn = async (server: pg.Client): Promise<void> => {
    const { rows } = await server.query<{ datname: string }>('select datname from pg_database');

    for (const { datname } of rows.filter((row) => runOf(row.datname, url) === session.id)) {
      await server.query(dropping(datname));
    }
  };

  await dropOwn(session.server())
    .catch(() => onServer(url, dropOwn))
    .catch(() => undefined);

  await session.end();
}

/**
 * Another session on the migrated database makes the server wait 5 seconds for it to leave, then
 * refuse: asked once more, since a migration or a console that was ending has ended by then.
 */
async function copied(server: pg.Client, database: string, template: string): Promise<void> {
  try {
    await server.query(copying(database, template)).catch((error: unknown) => {
      if (codeOf(error) !== OTHER_SESSIONS) {
        throw error;
      }

      return server.query(copying(database, template));
    });
  } catch (error) {
    const refusal = REFUSALS[codeOf(error)];

    throw refusal === undefined ? error : new Error(refusal(database), { cause: error });
  }
}

/** One line for each thing a reader may have to act on: rows that are gone, tables left as they were, a copy that took time. */
function said({ held, ofAnotherRole, bytes }: Emptied, database: string, seconds: number): string {
  const gone = `The run emptied ${held.length} table(s) of its copy of "${database}" that held rows (${named(held)}): a spec stores the rows it needs, and a table whose rows the application reads is listed in KEPT_TABLES of test/support/test-database-kept.ts.`;
  const left = `It left ${ofAnotherRole.length} table(s) with their rows, which another role owns (${named(ofAnotherRole)}).`;
  const large = `Those rows take ${Math.round(bytes / (1024 * 1024))} MB: copying them took ${seconds} s of this run. Give the tests a database of their own, migrated and empty: create it, name it in DATABASE_URL, then npm run db:migrate.`;

  return [
    ...(held.length > 0 ? [gone] : []),
    ...(ofAnotherRole.length > 0 ? [left] : []),
    ...(bytes >= LARGE ? [large] : []),
  ]
    .map((line) => line + '\n')
    .join('');
}

function named(tables: readonly string[]): string {
  const others = tables.length - NAMED;

  return tables.slice(0, NAMED).join(', ') + (others > 0 ? ` and ${others} more` : '');
}
