import { randomBytes } from 'node:crypto';
import { setTimeout as later } from 'node:timers/promises';
import type pg from 'pg';
import { connectedTo, keyOf, LIVE, locked } from '{{alias.test}}/support/test-database-server{{alias.ext}}';

/** A run says that it lives every 15 seconds, and is held dead a minute after it last did (test-database-leftovers.ts). */
const BEAT_SECONDS = 15;

export const DEAD_AFTER_SECONDS = 60;
/** What the comment of a run starts with, on the database that carries it, before the seconds of the clock of the server. */
export const BEAT = 'ddd-ts-kit run ';

/** How many times, a second apart, a run tries to take a session again before it says that it could not. */
const ATTEMPTS = 5;

/** What says that a run lives: its lock, held by one session, and the comment it refreshes on its template. */
export interface RunSession {
  readonly id: string;

  /** The session that holds the lock now: another one once the server ended the first. */
  server(): pg.Client;

  /** Says on `database`, now and every 15 seconds from now, that the run lives. */
  beatOn(database: string): Promise<void>;

  /** Lets the lock go. Never throws: a session the server ended is ended. */
  end(): Promise<void>;
}

interface Held {
  readonly url: string;
  readonly tell: (line: string) => void;
  id: string;
  client: pg.Client;
  retaking: boolean;
  ended: boolean;
  beating?: NodeJS.Timeout;
}

/**
 * Opens the session of a run and takes the lock of a name no living run has, before any database
 * carries it. A session can end while the run lives (the server restarts or fails over, an
 * administrator ends it, sessions idle too long are ended, the machine slept): the run then takes
 * another one and its lock again, at once, and says so when it could not. The lock is one of a
 * session: the address is a direct one, never a pooler that hands a session to others.
 */
export async function openSession(url: string, tell: (line: string) => void): Promise<RunSession> {
  const held: Held = { url, tell, id: '', client: await connectedTo(url), retaking: false, ended: false };

  held.id = await lockedRun(held.client);
  watch(held, held.client);

  return {
    id: held.id,
    server: () => held.client,
    beatOn: (database) => beatingOn(held, database),
    end: () => ended(held),
  };
}

async function lockedRun(client: pg.Client): Promise<string> {
  const id = randomBytes(4).toString('hex');

  return (await locked(client, `pg_try_advisory_lock(${LIVE}, ${keyOf(id)})`)) ? id : lockedRun(client);
}

/** A client whose session the server ended emits an error, more than once: with nobody listening, it would end the runner. */
function watch(held: Held, client: pg.Client): void {
  client.on('error', () => {
    if (held.client === client && !held.retaking && !held.ended) {
      held.retaking = true;

      void retaken(held, ATTEMPTS).finally(() => {
        held.retaking = false;
      });
    }
  });
}

async function retaken(held: Held, attempts: number): Promise<void> {
  try {
    const client = await connectedTo(held.url);

    watch(held, client);

    if (!(await locked(client, `pg_try_advisory_lock(${LIVE}, ${keyOf(held.id)})`))) {
      await client.end();

      throw new Error('another session holds the lock of the run');
    }

    held.client = client;
  } catch (error) {
    if (attempts > 1 && !held.ended) {
      await later(1000);
      await retaken(held, attempts - 1);
    } else if (!held.ended) {
      held.tell(
        `The run lost its session on the server and could not take it again (${String(error)}): a minute from now nothing says that its databases are in use, and another run may drop them. A spec file that finds its database gone failed for that reason: run again.\n`,
      );
    }
  }
}

async function beatingOn(held: Held, database: string): Promise<void> {
  const name = "'" + database.replaceAll("'", "''") + "'";
  const beat = `do $$ begin execute format('comment on database %I is %L', ${name}, '${BEAT}' || extract(epoch from now())::bigint); end $$`;

  await held.client.query(beat);
  // Between two sessions a beat is lost: the next one says it, well before the run is held dead.
  held.beating = setInterval(() => void held.client.query(beat).catch(() => undefined), BEAT_SECONDS * 1000);
  held.beating.unref();
}

async function ended(held: Held): Promise<void> {
  held.ended = true;
  clearInterval(held.beating);
  await held.client.end().catch(() => undefined);
}
