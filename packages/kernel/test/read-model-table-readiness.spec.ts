import { describe, expect, it } from 'vitest';
import {
  InMemoryLogger,
  PostgresReadModelTables,
  PostgresTraceColumns,
  ReadModelTableNotReadyError,
  ReadModelTablesNotReadyError,
  type UnreadyReadModelTable,
} from '../src';
import { liveRowsConstraintOf } from '../src/infrastructure/read-model/live-rows-constraint-of';
import { readModelTableMigration } from '../src/infrastructure/read-model/read-model-table-migration';

const AGENDA: UnreadyReadModelTable = {
  schema: 'scheduling',
  table: 'agenda',
  refusing: ['starts_at'],
  row: ['starts_at', 'note'],
  constraint: false,
};

describe('ReadModelTableNotReadyError', () => {
  it('names the table, the column that refuses NULL, the missing constraint and the migration to write', () => {
    const error = new ReadModelTableNotReadyError(AGENDA);

    expect(error.name).toBe('ReadModelTableNotReadyError');
    expect(error.table).toBe('scheduling.agenda');
    expect(error.columns).toEqual(['starts_at']);
    expect(error.unready).toBe(AGENDA);

    expect(error.message).toBe(
      [
        'The read model table scheduling.agenda cannot hold the trace of a deleted row: "starts_at" refuses NULL, and a deleted row keeps its key and its stamp only. The check constraint agenda_live_rows_whole, which keeps the live rows whole, is missing. The migration to write:',
        'alter table scheduling.agenda',
        '  alter column "starts_at" drop not null,',
        '  add constraint agenda_live_rows_whole check (deleted or ("starts_at" is not null));',
        'update scheduling.agenda set "starts_at" = null, "note" = null where deleted;',
      ].join('\n'),
    );

    expect(error.message.endsWith(error.migration)).toBe(true);
  });

  it('names every column when several refuse NULL', () => {
    const { message } = new ReadModelTableNotReadyError({ ...AGENDA, refusing: ['starts_at', 'status'] });

    expect(message).toContain('"starts_at", "status" refuse NULL');
    expect(message).toContain('  alter column "starts_at" drop not null,\n  alter column "status" drop not null,');
    expect(message).toContain('check (deleted or ("starts_at" is not null and "status" is not null))');
  });

  it('leaves a constraint the table holds as it is, and says what its check has to hold', () => {
    const { message, migration } = new ReadModelTableNotReadyError({ ...AGENDA, constraint: true });

    expect(message).toContain(
      'The check constraint agenda_live_rows_whole is there: whether it holds these columns was not read.',
    );

    expect(migration).toBe(
      [
        'alter table scheduling.agenda',
        '  alter column "starts_at" drop not null;',
        '-- agenda_live_rows_whole is there already: if its check does not hold ("starts_at" is not null), drop it and add it again with them.',
        'update scheduling.agenda set "starts_at" = null, "note" = null where deleted;',
      ].join('\n'),
    );
  });

  it('says, of a definition that refuses NULL, what to declare there and what the database takes', () => {
    const { message, table } = new ReadModelTableNotReadyError({
      table: 'agenda',
      refusing: ['status'],
      row: ['status'],
    });

    expect(table).toBe('agenda');

    expect(message).toContain(
      'The definition the store reads says so: declare these columns nullable there, with the check constraint agenda_live_rows_whole that keeps the live rows whole, and agenda takes the same in the database.',
    );

    expect(message).toContain('add constraint agenda_live_rows_whole check (deleted or ("status" is not null));');
  });

  it('quotes in the migration the identifiers PostgreSQL would not read as they stand', () => {
    const migration = readModelTableMigration({
      schema: 'Tenant-acme',
      table: 'agen"da',
      refusing: ['startsAt'],
      row: ['startsAt'],
      constraint: false,
    });

    expect(migration).toBe(
      [
        'alter table "Tenant-acme"."agen""da"',
        '  alter column "startsAt" drop not null,',
        '  add constraint "agen""da_live_rows_whole" check (deleted or ("startsAt" is not null));',
        'update "Tenant-acme"."agen""da" set "startsAt" = null where deleted;',
      ].join('\n'),
    );
  });

  it('names the constraint as PostgreSQL keeps it, cut at 63 bytes', () => {
    expect(liveRowsConstraintOf('agenda')).toBe('agenda_live_rows_whole');
    expect(liveRowsConstraintOf('a'.repeat(60))).toBe(`${'a'.repeat(60)}_li`);
  });
});

describe('PostgresTraceColumns', () => {
  /** A database whose table refuses NULL in these columns, and holds its check constraint or not. */
  const aDatabase = (refusing: readonly string[], constraint = false) => {
    const statements: [string, readonly unknown[]][] = [];

    const run = async (statement: string, parameters: readonly unknown[]) => {
      statements.push([statement, parameters]);

      if (statement.includes('pg_constraint')) {
        return constraint ? [{ constraint: parameters[1] }] : [];
      }

      return refusing.map((column) => ({ column }));
    };

    return { statements, run };
  };

  it('reads once the columns of the table as a statement resolves it, and lets a ready table through', async () => {
    const { statements, run } = aDatabase(['id', 'last_event_id']);
    const traces = new PostgresTraceColumns(run, () => ({ table: 'agenda', data: ['status', 'starts_at'] }));

    await traces.require();
    await traces.require();

    expect(statements).toEqual([
      [
        'select attname as "column" from pg_attribute where attrelid = to_regclass($1) and attnotnull and attnum > 0 and not attisdropped',
        ['"agenda"'],
      ],
    ]);
  });

  it('refuses by name a table whose columns refuse NULL in the database, each time it is asked', async () => {
    const { statements, run } = aDatabase(['id', 'status']);
    const target = { schema: 'sched"uling', table: 'agenda', data: ['status', 'starts_at'] };
    const traces = new PostgresTraceColumns(run, () => target);

    await expect(traces.require()).rejects.toThrow(ReadModelTableNotReadyError);
    await expect(traces.require()).rejects.toMatchObject({ table: 'sched"uling.agenda', columns: ['status'] });

    expect(statements.map(([, parameters]) => parameters)).toEqual([
      ['"sched""uling"."agenda"'],
      ['"sched""uling"."agenda"', 'agenda_live_rows_whole'],
      ['"sched""uling"."agenda"'],
      ['"sched""uling"."agenda"', 'agenda_live_rows_whole'],
    ]);
  });

  it('says of the table it refuses whether its check constraint is missing, and every column to empty', async () => {
    const target = { table: 'agenda', data: ['status', 'starts_at'] };
    const without = new PostgresTraceColumns(aDatabase(['status']).run, () => target);
    const holding = new PostgresTraceColumns(aDatabase(['status'], true).run, () => target);

    await expect(without.require()).rejects.toMatchObject({
      unready: { table: 'agenda', refusing: ['status'], row: ['status', 'starts_at'], constraint: false },
    });

    await expect(without.require()).rejects.toThrow('The check constraint agenda_live_rows_whole, which keeps');
    await expect(holding.require()).rejects.toMatchObject({ unready: { constraint: true } });
  });
});

/** A column of the catalog, as the statement of the check answers it. */
const column = (path: string, flags: { refusing?: boolean; key?: boolean; whole?: boolean } = {}) => {
  const [schema, table, name] = path.split('.');

  return { schema, table, column: name, refusing: false, key: false, whole: false, ...flags };
};

const STAMP = ['last_event_id', 'last_event_at', 'last_event_version', 'deleted'];

/** The columns of a read model table: its key, its tenant and its stamp, then those of its row. */
const readModel = (table: string, row: readonly ReturnType<typeof column>[], whole = false) =>
  [
    column(`${table}.id`, { refusing: true, key: true }),
    column(`${table}.tenant_id`, { refusing: true }),
    ...STAMP.map((name) => column(`${table}.${name}`, { refusing: name !== 'last_event_version' })),
    ...row,
  ].map((read) => ({ ...read, whole }));

describe('PostgresReadModelTables', () => {
  const tablesOf = (columns: readonly ReturnType<typeof column>[], kept?: readonly string[]) => {
    const statements: [string, readonly unknown[]][] = [];

    const tables = new PostgresReadModelTables(
      async (statement, parameters) => {
        statements.push([statement, parameters]);

        return columns;
      },
      kept === undefined ? {} : { kept },
    );

    return { statements, tables };
  };

  const agenda = readModel('scheduling.agenda', [
    column('scheduling.agenda.status', { refusing: true }),
    column('scheduling.agenda.note'),
  ]);

  const contacts = readModel(
    'notification.contacts',
    [column('notification.contacts.address', { refusing: true })],
    true,
  );

  const ready = readModel('analytics.outcomes', [column('analytics.outcomes.state')], true);

  it('reads the catalog once, the tables that hold the stamp of a read model, in one statement', async () => {
    const { statements, tables } = tablesOf(ready);

    expect(await tables.notReady()).toEqual([]);
    await tables.require();

    expect(statements).toHaveLength(2);
    expect(statements[0]?.[1]).toEqual([]);

    expect(statements[0]?.[0]).toContain(
      "stamp.attname in ('last_event_id', 'last_event_at', 'last_event_version', 'deleted')",
    );

    expect(statements[0]?.[0]).toContain("left(held.relname || '_live_rows_whole', 63)");
  });

  it('names every table that is not ready, its key, its tenant and its stamp left out', async () => {
    const { tables } = tablesOf([...ready, ...contacts, ...agenda]);

    expect(await tables.notReady()).toEqual([
      { schema: 'notification', table: 'contacts', refusing: ['address'], row: ['address'], constraint: true },
      { schema: 'scheduling', table: 'agenda', refusing: ['status'], row: ['status', 'note'], constraint: false },
    ]);
  });

  it('leaves out the columns the options name, and the copy of a rebuild in progress', async () => {
    const copy = agenda.map((read) => ({ ...read, table: 'agenda__rebuild' }));
    const alone = ready.map((read) => ({ ...read, table: 'lone__rebuild', refusing: true }));
    const kept = ['scheduling.agenda__rebuild.status'];

    expect(await tablesOf([...agenda, ...copy], kept).tables.notReady()).toMatchObject([{ table: 'agenda' }]);
    expect(await tablesOf([...agenda, ...copy], ['scheduling.agenda.status']).tables.notReady()).toEqual([]);

    // A table named like a copy, whose table is not there, is a read model like another.
    expect(await tablesOf(alone).tables.notReady()).toEqual([
      { schema: 'analytics', table: 'lone__rebuild', refusing: ['state'], row: ['state'], constraint: true },
    ]);
  });

  it('refuses with one error that names every table and writes the migration of each', async () => {
    const { tables } = tablesOf([...contacts, ...agenda]);
    const refusal = await tables.require().catch((error: unknown) => error);

    expect(refusal).toBeInstanceOf(ReadModelTablesNotReadyError);
    expect(refusal).toMatchObject({ name: 'ReadModelTablesNotReadyError' });

    expect(refusal).toMatchObject({
      tables: [
        { table: 'notification.contacts', columns: ['address'] },
        { table: 'scheduling.agenda', columns: ['status'] },
      ],
    });

    const { message } = refusal instanceof Error ? refusal : new Error('not refused');

    expect(message.split('\n\n')).toEqual([
      '2 read model tables are not ready for this version: notification.contacts, scheduling.agenda. Apply the migrations of the project before the application starts; a table they leave as it is takes the migration written under its name.',
      new ReadModelTableNotReadyError({
        schema: 'notification',
        table: 'contacts',
        refusing: ['address'],
        row: ['address'],
        constraint: true,
      }).message,
      new ReadModelTableNotReadyError({
        schema: 'scheduling',
        table: 'agenda',
        refusing: ['status'],
        row: ['status', 'note'],
        constraint: false,
      }).message,
    ]);

    expect(new ReadModelTablesNotReadyError([AGENDA]).message).toContain('1 read model table is not ready');
  });

  it('refuses the start of an application by default, and logs nothing', async () => {
    const logger = new InMemoryLogger();

    await expect(tablesOf(agenda).tables.atStart(logger)).rejects.toThrow(ReadModelTablesNotReadyError);
    await tablesOf(ready).tables.atStart(logger);

    expect(logger.entries).toEqual([]);
  });

  it('reports the tables as one error and lets the start go on, when the application asks for it', async () => {
    const logger = new InMemoryLogger();

    await tablesOf(ready).tables.atStart(logger, 'reported');

    expect(logger.entries).toEqual([]);

    await tablesOf([...contacts, ...agenda]).tables.atStart(logger, 'reported');

    expect(logger.entries).toEqual([
      {
        level: 'error',
        message: expect.stringContaining('2 read model tables are not ready for this version'),
        fields: { tables: 'notification.contacts, scheduling.agenda' },
      },
    ]);
  });
});
