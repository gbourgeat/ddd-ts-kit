import { describe, expect, it } from 'vitest';
import { InMemoryLogger, ReadModelTables, ReadModelTablesNotReadyError, type ReadModelTableState } from '../src';
import { databaseFailure } from '../src/infrastructure/read-model/database-failure';

const STATEMENT = 'select col.attname as "column", col.attnotnull as "refusing" from pg_attribute as col';

/** An error as a driver raises it, with what it carries beside its message. */
const failed = (message: string, carried: Record<string, unknown> = {}): Error =>
  Object.assign(new Error(message), carried);

/** `connect ECONNREFUSED`, as Node raises it for one address. */
const refused = (address: string) =>
  failed(`connect ECONNREFUSED ${address}:5432`, { code: 'ECONNREFUSED', address, port: 5432 });

/** Every shape in which a database that was never reached comes back, through each ORM. */
const UNREACHABLE: readonly (readonly [shape: string, failure: unknown, cause: string])[] = [
  ['the driver alone', refused('127.0.0.1'), 'ECONNREFUSED 127.0.0.1:5432'],
  [
    'Node trying both addresses of localhost, under the query error of Drizzle',
    failed(`Failed query: ${STATEMENT}\nparams: "billing"."invoices"`, {
      cause: Object.assign(new AggregateError([refused('::1'), refused('127.0.0.1')], ''), { code: 'ECONNREFUSED' }),
    }),
    'ECONNREFUSED',
  ],
  [
    'the driver adapter of Prisma, under a raw query that failed',
    failed('\nInvalid `prisma.$queryRawUnsafe()` invocation:\n\nRaw query failed.', {
      code: 'P2010',
      meta: {
        driverAdapterError: failed('DatabaseNotReachable', {
          name: 'DriverAdapterError',
          cause: { kind: 'DatabaseNotReachable', host: 'db', port: 5432 },
        }),
      },
    }),
    'DatabaseNotReachable db:5432',
  ],
  [
    'a host that is not found',
    failed('getaddrinfo ENOTFOUND db', { code: 'ENOTFOUND' }),
    'ENOTFOUND getaddrinfo ENOTFOUND db',
  ],
  ['a timeout of the network', failed('connect ETIMEDOUT', { code: 'ETIMEDOUT' }), 'ETIMEDOUT connect ETIMEDOUT'],
  [
    'the pool of Knex, which found no connection in time',
    failed('Knex: Timeout acquiring a connection. The pool is probably full.', { name: 'KnexTimeoutError' }),
    'Knex: Timeout acquiring a connection. The pool is probably full.',
  ],
  [
    'the query error of TypeORM over a connection the server closed',
    failed(`${STATEMENT} - Connection terminated unexpectedly`, {
      name: 'QueryFailedError',
      driverError: failed('Connection terminated unexpectedly'),
      cause: failed('read ECONNRESET', { code: 'ECONNRESET' }),
    }),
    'ECONNRESET read ECONNRESET',
  ],
  [
    'a data source of TypeORM that is not open',
    failed('Cannot execute operation on "default" connection because connection is not yet established.', {
      name: 'CannotExecuteNotConnectedError',
    }),
    'Cannot execute operation on "default" connection because connection is not yet established.',
  ],
  [
    'Prisma, which cannot reach the server',
    failed("Can't reach database server at `db:5432`", { code: 'P1001' }),
    "P1001 Can't reach database server at `db:5432`",
  ],
  [
    'PostgreSQL while it starts',
    failed('the database system is starting up', { code: '57P03', severity: 'FATAL' }),
    '57P03 the database system is starting up',
  ],
  [
    'a connection PostgreSQL ends',
    failed('connection failure', { code: '08006', severity: 'FATAL' }),
    '08006 connection failure',
  ],
];

/** A database that was reached and said no: an answer, whatever wraps it. */
const REACHED: readonly (readonly [shape: string, failure: unknown, cause: string])[] = [
  [
    'a schema the role may not use, under the query error of Drizzle',
    failed(`Failed query: ${STATEMENT}`, {
      cause: failed('permission denied for schema billing', { code: '42501', severity: 'ERROR' }),
    }),
    '42501 permission denied for schema billing',
  ],
  [
    'the same as Knex writes it, the statement before the message',
    failed(`${STATEMENT} - permission denied for schema billing`, { code: '42501', severity: 'ERROR' }),
    '42501 permission denied for schema billing',
  ],
  ['an error of the code of the application', new TypeError('no such entity'), 'no such entity'],
  ['something thrown that is no error', 'refused', 'refused'],
  ['an error that is its own cause', loop(), 'again'],
];

function loop(): Error {
  const error = failed('again');

  return Object.assign(error, { cause: error });
}

describe('databaseFailure', () => {
  it.each(UNREACHABLE)('reads as a database that was not reached: %s', (_shape, failure, cause) => {
    expect(databaseFailure(failure)).toEqual({ unreachable: true, cause });
  });

  it.each(REACHED)('reads as an answer of the database, told shortly: %s', (_shape, failure, cause) => {
    expect(databaseFailure(failure)).toEqual({ unreachable: false, cause });
    expect(databaseFailure(failure).cause).not.toContain('select col.attname');
  });
});

const READY: ReadModelTableState = {
  schema: 'billing',
  table: 'invoices',
  exists: true,
  refusing: [],
  unfit: [],
  row: ['total'],
  deleted: 'deleted',
  constraint: { state: 'held', columns: ['total'] },
};

describe('ReadModelTables, when the database cannot be reached', () => {
  const asked: string[] = [];

  const entry = (name: string, answer: () => Promise<ReadModelTableState>) => ({
    name,
    build: () => ({
      tableState: () => {
        asked.push(name);

        return answer();
      },
    }),
  });

  const tables = () =>
    new ReadModelTables([
      entry('Invoices', () => Promise.resolve(READY)),
      entry('Ledger', () => Promise.reject(UNREACHABLE[1]?.[1])),
      entry('Parcels', () => Promise.resolve(READY)),
    ]);

  it('starts with one warning that says why in a few words, required or reported, and asks nothing more of the database', async () => {
    for (const mode of ['required', 'reported'] as const) {
      const logger = new InMemoryLogger();

      asked.length = 0;
      await tables().atStart(logger, mode);

      expect(logger.entries.map(({ level, message }) => [level, message])).toEqual([
        [
          'warn',
          'The read model tables could not be checked: the database could not be reached (ECONNREFUSED). The start goes on; each store still refuses a table that is not ready before its first trace.',
        ],
      ]);

      expect(asked).toEqual(['Invoices', 'Ledger']);
    }
  });

  it('still refuses the start on a table that was read and is not ready, and on one the database refused to read', async () => {
    const denied = new ReadModelTables([
      entry('Invoices', () => Promise.reject(REACHED[0]?.[1])),
      entry('Ledger', () => Promise.reject(UNREACHABLE[0]?.[1])),
    ]);

    const refusal: unknown = await denied.atStart(new InMemoryLogger()).catch((error: unknown) => error);

    expect(refusal).toBeInstanceOf(ReadModelTablesNotReadyError);
    expect(refusal).toMatchObject({ unread: [{ name: 'Invoices' }] });

    expect(refusal instanceof Error ? refusal.message : '').toBe(
      'The table of 1 read model could not be read, so nothing says whether a trace is taken: Invoices (42501 permission denied for schema billing).',
    );
  });

  it('tells a command that the database could not be read, with the same short cause', async () => {
    const report = await tables().report();

    expect(report).toMatchObject({ ready: false, outcome: 'unread' });

    expect(report.text).toContain(
      'could not be read, so nothing says whether a trace is taken: Ledger (ECONNREFUSED).',
    );

    expect(report.text).not.toContain('select col.attname');
    await expect(tables().require()).rejects.toThrow('Ledger (ECONNREFUSED)');
  });
});
