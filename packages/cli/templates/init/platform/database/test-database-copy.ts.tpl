import { setTimeout as later } from 'node:timers/promises';
import type pg from 'pg';
import { codeOf, copying, databaseOf, dropping, oneAtATime, onServer } from './test-database-server{{alias.sibling}}';

/** The SQLSTATE of a server that refuses to copy a database other sessions are connected to. */
const OTHER_SESSIONS = '55006';
/** The SQLSTATE of a statement somebody cancelled: its session lives. */
const CANCELLED = '57014';
/** The SQLSTATE of a session that ended: the server stopped it (57P01 and its neighbours), the connection failed (class 08). */
const SESSION_ENDED = /^(?:57P|08)/;

const REFUSALS: Readonly<Record<string, (database: string) => string>> = {
  [OTHER_SESSIONS]: (database) =>
    `The database "${database}" has other sessions (an application that runs, a console, a migration): PostgreSQL copies a database only while nobody else is connected to it. Close them, or give the tests a database of their own.`,
  '42501': (database) =>
    `The role of DATABASE_URL may not copy the database "${database}", and each spec file runs on a copy of it: the role creates databases (alter role <role> createdb) and owns that one (alter database "${database}" owner to <role>).`,
  '3D000': (database) =>
    `The server of DATABASE_URL has no database "${database}": create it, then migrate it (npm run db:migrate).`,
  // The sessions of a run set no timeout (test-database-server.ts): the statement was cancelled from outside, and is not taken again.
  [CANCELLED]: (database) =>
    `The copy of the database "${database}" was cancelled: the run sets no statement timeout on its own sessions, so somebody or a tool of the server cancelled the statement (pg_cancel_backend, a job that cancels the statements that last). Run again, or find what cancels it in the log of the server.`,
};

/**
 * Copies the migrated database `url` names as `template`, one run at a time on the server: two
 * copies at once slow each other. The copy has a session of its own, and a session can end while
 * it works (the server restarts or fails over, an administrator ends it): what is left of the copy
 * is then dropped and the copy made once more, on another session.
 */
export async function copied(url: string, template: string): Promise<void> {
  const once = (): Promise<void> =>
    onServer(url, (server) => oneAtATime(server, '0', () => copiedOn(server, databaseOf(url), template)));

  try {
    await once().catch(async (error: unknown) => {
      if (!sessionEnded(error)) {
        throw error;
      }

      await later(1000);
      await onServer(url, (server) => server.query(dropping(template)));
      await once();
    });
  } catch (error) {
    throw notCopied(databaseOf(url), error);
  }
}

/** The client says it without a SQLSTATE, the server with one of class 08 or 57P: a cancelled statement (57014) is not an ended session. */
function sessionEnded(error: unknown): boolean {
  return codeOf(error) === ''
    ? /connection|terminat|queryable/i.test(String(error))
    : SESSION_ENDED.test(codeOf(error));
}

/**
 * Another session on the migrated database makes the server wait 5 seconds for it to leave, then
 * refuse: asked once more, since a migration or a console that was ending has ended by then.
 */
async function copiedOn(server: pg.Client, database: string, template: string): Promise<void> {
  await server.query(copying(database, template)).catch((error: unknown) => {
    if (codeOf(error) !== OTHER_SESSIONS) {
      throw error;
    }

    return server.query(copying(database, template));
  });
}

function notCopied(database: string, error: unknown): unknown {
  const refusal = REFUSALS[codeOf(error)]?.(database);
  const twice = `The session that copied the database "${database}" ended twice before the copy did (${String(error)}): the server restarts, fails over, or ends the sessions of the run. Run again once it is steady.`;
  const said = refusal ?? (sessionEnded(error) ? twice : undefined);

  return said === undefined ? error : new Error(said, { cause: error });
}
