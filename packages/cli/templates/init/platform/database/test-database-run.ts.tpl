import type pg from 'pg';
import { poolSizeFor } from './test-database-budget{{alias.sibling}}';
import { copied } from './test-database-copy{{alias.sibling}}';
import { emptied, type Emptied } from './test-database-emptying{{alias.sibling}}';
import { dropLeftovers } from './test-database-leftovers{{alias.sibling}}';
import { databaseOf, dropping, nameOf, onServer, runOf, TEMPLATE } from './test-database-server{{alias.sibling}}';
import { openSession, type RunSession } from './test-database-session{{alias.sibling}}';

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
const NAMED = 20;

/**
 * Starts a run on the server `url` names, in which `atOnce` spec files run at the same time: takes
 * the lock that says it lives, drops what the runs that died left, refuses a run the connections
 * of the server cannot take, then copies the migrated database (test-database-copy.ts) and empties
 * the copy. The global setup of the end-to-end run calls it once, where no timeout of
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

    await copied(url, template);
    await session.beatOn(template);

    for (const line of said(await emptied(url, template), databaseOf(url), Math.ceil((Date.now() - from) / 1000))) {
      tell(line + '\n');
    }

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

/** One line for each thing a reader may have to act on: rows that are gone, tables left as they were, names that keep nothing, a copy that took time. */
function said({ held, ofAnotherRole, unmatched, bytes }: Emptied, database: string, seconds: number): string[] {
  const gone = `The run emptied ${held.length} table(s) of its copy of "${database}" that held rows (${named(held)}): a spec stores the rows it needs, and a table whose rows the application reads is listed in KEPT_TABLES of test/support/test-database-kept.ts.`;
  const left = `It left ${ofAnotherRole.length} table(s) with their rows, which another role owns or whose schema the role of the run may not use (${named(ofAnotherRole)}).`;
  const large = `Those rows take ${Math.round(bytes / (1024 * 1024))} MB: copying them took ${seconds} s of this run. Give the tests a database of their own, migrated and empty: create it, name it in DATABASE_URL, then npm run db:migrate.`;

  return [
    ...(held.length > 0 ? [gone] : []),
    ...(ofAnotherRole.length > 0 ? [left] : []),
    ...unmatched.map(
      (name) =>
        `KEPT_TABLES of test/support/test-database-kept.ts lists ${name}, which is no table of "${database}" and keeps nothing: a name is written as the server stores it, in lower case unless the table was created between quotes, and a view holds no rows of its own.`,
    ),
    ...(bytes >= LARGE ? [large] : []),
  ];
}

function named(tables: readonly string[]): string {
  const others = tables.length - NAMED;

  return tables.slice(0, NAMED).join(', ') + (others > 0 ? ` and ${others} more` : '');
}
