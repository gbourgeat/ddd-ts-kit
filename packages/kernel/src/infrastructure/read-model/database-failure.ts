/** What a failed read of the database comes down to, once the wrappings of the driver and of the ORM are opened. */
interface DatabaseFailure {
  /** True when the database was never reached: no answer is not an answer about a table. */
  readonly unreachable: boolean;
  /** The cause in a few words, as the driver says it: its code and its address, or its message; never the statement. */
  readonly cause: string;
}

/** The errors of the network a connection ends with before the server answers. */
const NETWORK = new Set([
  'ECONNREFUSED',
  'ECONNRESET',
  'ENOTFOUND',
  'EAI_AGAIN',
  'ETIMEDOUT',
  'EHOSTUNREACH',
  'ENETUNREACH',
  'EPIPE',
]);

/** What a driver or an ORM names an attempt that found no connection: TypeORM before its data source is open, the pool of Knex. */
const NOT_CONNECTED = /^(CannotExecuteNotConnectedError|CannotConnectAlreadyConnectedError|KnexTimeoutError)$/;

/** Prisma: the server cannot be reached, timed out, or closed the connection. */
const PRISMA = /^P10(01|02|08|17)$/;

/** What a driver adapter of Prisma says under `meta.driverAdapterError`, when it found no server. */
const ADAPTER = /^(DatabaseNotReachable|SocketTimeout|ConnectionClosed)$/;

/**
 * Reads the failure of a statement through what wraps it: the `cause` of each error, the errors
 * an `AggregateError` gathers (Node tries every address of a host) and the error a driver adapter
 * of Prisma hands under `meta`, as Drizzle, Knex, Prisma and TypeORM each wrap the error of the
 * driver. The database is unreachable when one of them is an error of the network, an error of
 * connection of PostgreSQL (class 08, or 57P03 while the server starts), or what an ORM raises
 * when it holds no connection. The short cause is the one of that error, else of the innermost
 * one: the message of a wrapper often is the statement.
 */
export function databaseFailure(failure: unknown): DatabaseFailure {
  const chain = opened(failure);
  const unreached = chain.find(isUnreachable);
  const told = unreached ?? chain.at(-1);

  return { unreachable: unreached !== undefined, cause: told === undefined ? String(failure) : shortly(told) };
}

/** The error and everything under it, outermost first; a loop of causes is read once. */
function opened(failure: unknown, seen: readonly unknown[] = []): readonly object[] {
  if (typeof failure !== 'object' || failure === null || seen.includes(failure)) {
    return [];
  }

  return [failure, ...under(failure).flatMap((inner) => opened(inner, [...seen, failure]))];
}

/** What an error wraps: the errors it gathers, the error of a driver adapter of Prisma, its cause. */
function under(failure: object): readonly unknown[] {
  const gathered = held(failure, 'errors');
  const several: readonly unknown[] = Array.isArray(gathered) ? gathered : [];
  const meta = held(failure, 'meta');
  const adapter = typeof meta === 'object' && meta !== null ? held(meta, 'driverAdapterError') : undefined;

  return [...several, adapter, held(failure, 'cause')];
}

function isUnreachable(error: object): boolean {
  const code = text(held(error, 'code')) ?? '';
  const ofPostgres = code.startsWith('08') || code === '57P03';
  const named = NOT_CONNECTED.test(text(held(error, 'name')) ?? '') || ADAPTER.test(text(held(error, 'kind')) ?? '');

  return NETWORK.has(code) || ofPostgres || PRISMA.test(code) || named;
}

function shortly(error: object): string {
  const code = text(held(error, 'code')) ?? text(held(error, 'kind'));
  const host = text(held(error, 'address')) ?? text(held(error, 'host'));
  const port = text(held(error, 'port'));
  const said = (text(held(error, 'message')) ?? '').split('\n').find((line) => line.trim() !== '');
  // Knex writes the statement before the message of an error of the server: what follows the last dash is the driver's.
  const message = 'severity' in error ? said?.split(' - ').at(-1) : said;
  const address = host === undefined || port === undefined ? undefined : `${host}:${port}`;

  return [code, address ?? message].filter((part) => part !== undefined && part !== '').join(' ');
}

function held(value: object, key: string): unknown {
  return key in value ? Reflect.get(value, key) : undefined;
}

/** A text or a number as text: what a code, a name, a host or a port is. */
function text(value: unknown): string | undefined {
  return typeof value === 'string' || typeof value === 'number' ? String(value) : undefined;
}
