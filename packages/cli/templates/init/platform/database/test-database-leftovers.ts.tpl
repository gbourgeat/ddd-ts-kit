import type pg from 'pg';
import { dropping, keyOf, LIVE, locked, runOf } from './test-database-server{{alias.sibling}}';
import { BEAT, DEAD_AFTER_SECONDS } from './test-database-session{{alias.sibling}}';

interface Leftover {
  readonly name: string;
  /** The comment of the database: on its template, a run says when it last lived. */
  readonly said: string | null;
  /** The clock of the server, in seconds, as a text. */
  readonly now: string;
  readonly connected: boolean;
}

/**
 * Drops what the runs that died left on the server, in the session `server` of the run `own`. A
 * database is dropped when it is named after a run on the database `url` names, the lock of that
 * run is free, the run has not said for a minute that it lives, and nobody is connected to the
 * database. The lock alone is not enough: a run whose session the server ended takes it again a
 * moment later, and a file whose pool is idle has no session. A run that lives, in another
 * checkout or on another machine, therefore keeps its databases; a database with any other name is
 * never dropped; and what a run killed a moment ago left goes with a run that starts a minute later.
 */
export async function dropLeftovers(server: pg.Client, url: string, own: string): Promise<void> {
  const { rows } = await server.query<Leftover>(
    `select d.datname as name, shobj_description(d.oid, 'pg_database') as said, extract(epoch from now())::bigint::text as now,
            exists (select 1 from pg_stat_activity a where a.datid = d.oid) as connected
       from pg_database d`,
  );

  const left = rows.filter(({ name }) => ![undefined, own].includes(runOf(name, url)));

  for (const run of new Set(left.map(({ name }) => runOf(name, url) ?? ''))) {
    const ofTheRun = left.filter(({ name }) => runOf(name, url) === run);

    if (!lives(ofTheRun) && (await locked(server, `pg_try_advisory_lock(${LIVE}, ${keyOf(run)})`))) {
      // A database somebody is connected to is a file that still runs: asked to drop it, the server would wait 5 seconds, then refuse.
      for (const { name } of ofTheRun.filter((database) => !database.connected)) {
        await server.query(dropping(name, '')).catch(() => undefined);
      }

      await locked(server, `pg_advisory_unlock(${LIVE}, ${keyOf(run)})`);
    }
  }
}

function lives(databases: readonly Leftover[]): boolean {
  return databases.some(({ said, now }) => {
    const last = said?.startsWith(BEAT) === true ? Number(said.slice(BEAT.length)) : 0;

    return Number(now) - last < DEAD_AFTER_SECONDS;
  });
}
