import type pg from 'pg';

/** Stated by whoever starts the run: the connections it may take, when that is less than what the server has left. */
const STATED = 'TEST_DATABASE_CONNECTIONS';
/** The pool an application opens when nothing bounds it, and the one under which a request that waits for another never ends. */
const LARGEST_POOL = 10;
const SMALLEST_POOL = 2;
/** Beside its pool a file has one connection to spare: the one that copies and drops its database, a client a spec opens itself. */
const SPARE = 1;

/** One thing that bounds the connections of a run. */
interface Bound {
  readonly left: number;
  /** How a refusal says it. */
  readonly counted: string;
  /** What raises it. */
  readonly remedy: string;
}

type Counts = Record<'max' | 'reserved' | 'open' | 'limit' | 'openOfRole', number> & { readonly role: string };

/**
 * The pool of each file of a run in which `atOnce` files run at the same time: what the tightest
 * bound leaves, shared between them, less the connection each has to spare, 10 at most. A run that
 * does not fit is refused here with its numbers and what raises that bound, before any file
 * starts, instead of `too many clients` from the driver in the middle of a spec. The count is
 * taken once, on the session `server` of the run, itself among the connections open: a run that
 * starts later sees what this one has open, not what it will open.
 */
export async function poolSizeFor(server: pg.Client, atOnce: number): Promise<number> {
  const { left, counted, remedy } = tightest(await bounds(server));
  const each = SMALLEST_POOL + SPARE;
  const fitting = Math.floor(left / each);
  const fewer = fitting > 0 ? `run at most ${fitting} at once (npm run test:e2e -- --maxWorkers=${fitting}), or ` : '';

  if (fitting < atOnce) {
    throw new Error(
      `${atOnce} spec files at once need ${atOnce * each} connections (${SMALLEST_POOL} for each application at least and ${SPARE} to spare), and ${counted}: ${fewer}${remedy}.`,
    );
  }

  return Math.min(LARGEST_POOL, Math.floor(left / atOnce) - SPARE);
}

function tightest(all: readonly Bound[]): Bound {
  return all.reduce((least, bound) => (bound.left < least.left ? bound : least));
}

/** The server, the role when it has a limit of its own, and what TEST_DATABASE_CONNECTIONS states. */
async function bounds(server: pg.Client): Promise<Bound[]> {
  const { rows } = await server.query<Counts>(
    `select current_setting('max_connections')::int as max,
            current_setting('superuser_reserved_connections')::int + coalesce(current_setting('reserved_connections', true)::int, 0) as reserved,
            (select count(*)::int from pg_stat_activity where usesysid is not null and coalesce(backend_type, 'client backend') = 'client backend') as "open",
            (select case when rolsuper then -1 else rolconnlimit end from pg_roles where rolname = current_user) as "limit",
            (select count(*)::int from pg_stat_activity where usename = current_user) as "openOfRole",
            current_user::text as "role"`,
  );

  const [counts = { max: 0, reserved: 0, open: 0, limit: -1, openOfRole: 0, role: '' }] = rows;
  const ofTheServer = [boundOfTheServer(counts), ...(counts.limit < 0 ? [] : [boundOfTheRole(counts)])];

  return [...ofTheServer, ...stated(tightest(ofTheServer))];
}

function boundOfTheServer({ max, reserved, open }: Counts): Bound {
  return {
    left: max - reserved - open,
    counted: `the server leaves ${max - reserved - open} (max_connections ${max}, ${reserved} reserved, ${open} open)`,
    remedy: 'raise max_connections',
  };
}

function boundOfTheRole({ role, limit, openOfRole }: Counts): Bound {
  return {
    left: limit - openOfRole,
    counted: `the role ${role} has ${limit - openOfRole} left (connection limit ${limit}, ${openOfRole} open)`,
    remedy: `raise the limit of the role (alter role ${role} connection limit <more>)`,
  };
}

/** What the variable states, when it is set: a whole number of connections, no more than the server leaves. */
function stated(ofTheServer: Bound): Bound[] {
  const text = process.env[STATED] ?? '';
  const connections = Number(text);

  if (text === '') {
    return [];
  }

  if (!Number.isInteger(connections) || connections < 1) {
    throw new Error(`${STATED} is "${text}": state a whole number of connections, 1 or more, or leave it unset.`);
  }

  if (connections > ofTheServer.left) {
    throw new Error(
      `${STATED} states ${connections} connections, and ${ofTheServer.counted}: state ${ofTheServer.left} at most, or leave it unset.`,
    );
  }

  return [
    {
      left: connections,
      counted: `${STATED} allows ${connections}`,
      remedy: `state more in ${STATED} (${ofTheServer.left} at most)`,
    },
  ];
}
