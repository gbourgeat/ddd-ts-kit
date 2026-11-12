import { describe, expect, it } from 'vitest';
import {
  InMemoryLogger,
  InMemoryReadModelStore,
  PostgresTraceColumns,
  ReadModelTableNotReadyError,
  ReadModelTables,
  ReadModelTablesNotReadyError,
  defineCriteria,
  type ReadModelTableState,
} from '../src';
import { liveRowsConstraintOf } from '../src/infrastructure/read-model/live-rows-constraint-of';
import { readModelTableMigration } from '../src/infrastructure/read-model/read-model-table-migration';

const AGENDA: ReadModelTableState = {
  schema: 'scheduling',
  table: 'agenda',
  exists: true,
  refusing: ['starts_at'],
  unfit: [],
  row: ['starts_at', 'note'],
  deleted: 'deleted',
  constraint: { state: 'missing', columns: [] },
};

const READY: ReadModelTableState = { ...AGENDA, table: 'outcomes', refusing: [] };

const NOTE =
  '-- On a large table, run "validate constraint" in a transaction of its own (it then scans without stopping readers nor writers) and the update by ranges of the key: it rewrites only the deleted rows that still hold data.';

describe('ReadModelTableNotReadyError', () => {
  it('names the table, the column that refuses NULL, the missing constraint and the migration to write', () => {
    const error = new ReadModelTableNotReadyError(AGENDA);

    expect(error.name).toBe('ReadModelTableNotReadyError');
    expect(error.table).toBe('scheduling.agenda');
    expect(error.columns).toEqual(['starts_at']);
    expect(error.state).toBe(AGENDA);

    expect(error.statements).toEqual([
      'alter table "scheduling"."agenda" alter column "starts_at" drop not null;',
      'alter table "scheduling"."agenda" drop constraint if exists "agenda_live_rows_whole";',
      'alter table "scheduling"."agenda" add constraint "agenda_live_rows_whole" check ("deleted" or ("starts_at" is not null)) not valid;',
      'alter table "scheduling"."agenda" validate constraint "agenda_live_rows_whole";',
      'update "scheduling"."agenda" set "starts_at" = null, "note" = null where "deleted" and ("starts_at" is not null or "note" is not null);',
    ]);

    expect(error.message).toBe(
      [
        'The read model table scheduling.agenda cannot hold the trace of a deleted row: "starts_at" refuses NULL. A deleted row keeps its key, its tenant and its stamp only. The check constraint agenda_live_rows_whole, which keeps the live rows whole, is missing. The migration to write:',
        ...error.statements,
        NOTE,
      ].join('\n'),
    );
  });

  it('names every column when several refuse NULL, a table without a schema as it stands', () => {
    const error = new ReadModelTableNotReadyError({
      table: 'order',
      exists: true,
      refusing: ['a', 'b'],
      unfit: [],
      row: ['a', 'b'],
      deleted: 'removed',
      constraint: { state: 'missing', columns: [] },
    });

    expect(error.table).toBe('order');
    expect(error.message).toContain('"a", "b" refuse NULL');
    expect(error.statements[0]).toBe(
      'alter table "order" alter column "a" drop not null, alter column "b" drop not null;',
    );
    expect(error.statements[2]).toContain('check ("removed" or ("a" is not null and "b" is not null)) not valid;');
    expect(error.statements[4]).toBe(
      'update "order" set "a" = null, "b" = null where "removed" and ("a" is not null or "b" is not null);',
    );
  });

  it('writes a constraint again with the columns it held, leaves one that holds them, and validates one that is not', () => {
    const held = (columns: string[], found: 'held' | 'not-valid' = 'held') =>
      readModelTableMigration({ ...AGENDA, constraint: { state: found, columns } });

    expect(held(['note'])[2]).toContain(
      'check ("deleted" or ("note" is not null and "starts_at" is not null)) not valid;',
    );
    expect(held(['starts_at'])).toEqual([AGENDA_OPENED, AGENDA_EMPTIED]);
    expect(held(['starts_at'], 'not-valid')).toEqual([AGENDA_OPENED, AGENDA_VALIDATED, AGENDA_EMPTIED]);
    expect(readModelTableMigration({ ...READY, constraint: { state: 'not-valid', columns: ['note'] } })).toEqual([
      'alter table "scheduling"."outcomes" validate constraint "outcomes_live_rows_whole";',
    ]);
    expect(readModelTableMigration(READY)).toEqual([]);
  });

  it('leaves alone a constraint that checks something else, and says so', () => {
    const error = new ReadModelTableNotReadyError({
      ...AGENDA,
      constraint: { state: 'unexpected', columns: [], definition: "CHECK ((note <> ''::text))" },
    });

    expect(error.statements).toEqual([AGENDA_OPENED, AGENDA_EMPTIED]);

    expect(error.message).toContain(
      "A constraint agenda_live_rows_whole is there and checks something else (CHECK ((note <> ''::text))): the migration leaves it as it is, write by hand what keeps these columns whole in the live rows.",
    );
  });

  it('says, of a definition that refuses NULL, what to declare there, and writes no statement before the database is read', () => {
    const { constraint: unread, ...defined } = AGENDA;
    const error = new ReadModelTableNotReadyError(defined);

    expect(unread).toBeDefined();
    expect(error.statements).toEqual([]);

    expect(error.message).toBe(
      'The read model table scheduling.agenda cannot hold the trace of a deleted row: "starts_at" refuses NULL. A deleted row keeps its key, its tenant and its stamp only. The definition the store reads says so: declare these columns nullable there, with the check constraint agenda_live_rows_whole that keeps the live rows whole; the store then reads what scheduling.agenda needs in the database.',
    );
  });

  it('names the columns no migration opens, each with what it is, and writes nothing for them', () => {
    const error = new ReadModelTableNotReadyError({
      ...READY,
      unfit: [
        { column: 'region', because: 'primary-key' },
        { column: 'serial', because: 'identity' },
        { column: 'upper', because: 'generated' },
        { column: 'gone', because: 'absent' },
      ],
    });

    expect(error.statements).toEqual([]);

    expect(error.message).toBe(
      'The read model table scheduling.outcomes cannot hold the trace of a deleted row: "region" is part of the primary key; "serial" is an identity column; "upper" is a generated column; "gone" is not a column of the table. A deleted row keeps its key, its tenant and its stamp only. No migration opens a column of that kind: a store maps as a field of the row only a plain column, which a trace can hold NULL in. Take it out of the columns the store maps, or make it one.',
    );
  });

  it('says of a table that is not in the database that its migration did not run', () => {
    const { message, statements } = new ReadModelTableNotReadyError({ ...READY, exists: false, row: [] });

    expect(statements).toEqual([]);

    expect(message).toBe(
      'The read model table scheduling.outcomes cannot hold the trace of a deleted row: it is not in this database. The migration that creates it did not run on this database: apply the migrations of the project.',
    );
  });

  it('names the constraint as PostgreSQL keeps it, cut at 63 bytes and never inside a character', () => {
    expect(liveRowsConstraintOf('agenda')).toBe('agenda_live_rows_whole');
    expect(liveRowsConstraintOf('a'.repeat(60))).toBe(`${'a'.repeat(60)}_li`);
    expect(liveRowsConstraintOf('é'.repeat(31))).toBe(`${'é'.repeat(31)}_`);
    expect(liveRowsConstraintOf(`a${'é'.repeat(31)}`)).toBe(`a${'é'.repeat(31)}`);
  });
});

const AGENDA_OPENED = 'alter table "scheduling"."agenda" alter column "starts_at" drop not null;';
const AGENDA_VALIDATED = 'alter table "scheduling"."agenda" validate constraint "agenda_live_rows_whole";';

const AGENDA_EMPTIED =
  'update "scheduling"."agenda" set "starts_at" = null, "note" = null where "deleted" and ("starts_at" is not null or "note" is not null);';

/** A column of the catalog, as the statement of the columns answers it. */
const column = (
  name: string,
  flags: { refusing?: boolean; key?: boolean; identity?: boolean; generated?: boolean } = {},
) => ({
  column: name,
  refusing: false,
  key: false,
  identity: false,
  generated: false,
  ...flags,
});

/** A database that holds these columns for the table, and this constraint under its name. */
function aDatabase(columns: readonly ReturnType<typeof column>[], constraint?: { valid: boolean; definition: string }) {
  const statements: [string, readonly unknown[]][] = [];

  const run = async (statement: string, parameters: readonly unknown[]) => {
    statements.push([statement, parameters]);

    if (statement.includes('pg_constraint')) {
      return constraint === undefined ? [] : [constraint];
    }

    return columns;
  };

  return { statements, run };
}

const WHOLE = 'CHECK ((deleted OR ((status IS NOT NULL) AND ("startsAt" IS NOT NULL))))';

describe('PostgresTraceColumns', () => {
  const target = { table: 'agenda', data: ['status', 'startsAt'] };
  const held = [
    column('id', { refusing: true, key: true }),
    column('status'),
    column('startsAt'),
    column('last_event_id', { refusing: true }),
  ];

  it('reads once the columns of the table as a statement resolves it, and lets a ready table through', async () => {
    const { statements, run } = aDatabase(held);
    const traces = new PostgresTraceColumns(run, () => target);

    await traces.require();
    await traces.require();

    expect(statements.map(([, parameters]) => parameters)).toEqual([['"agenda"']]);
    expect(statements[0]?.[0]).toContain('from pg_attribute as col where col.attrelid = to_regclass($1)');
  });

  it('refuses by name a table whose columns refuse NULL in the database, each time it is asked, and then reads its constraint', async () => {
    const { statements, run } = aDatabase([...held, column('status', { refusing: true })]);
    const traces = new PostgresTraceColumns(run, () => ({ ...target, schema: 'sched"uling' }));

    await expect(traces.require()).rejects.toThrow(ReadModelTableNotReadyError);

    await expect(traces.require()).rejects.toMatchObject({
      table: 'sched"uling.agenda',
      columns: ['status'],
      state: { row: ['status', 'startsAt'], deleted: 'deleted', constraint: { state: 'missing', columns: [] } },
    });

    expect(statements.map(([, parameters]) => parameters)).toEqual([
      ['"sched""uling"."agenda"'],
      ['"sched""uling"."agenda"', 'agenda_live_rows_whole'],
      ['"sched""uling"."agenda"'],
      ['"sched""uling"."agenda"', 'agenda_live_rows_whole'],
    ]);
  });

  it('reads the state of the table for the columns the store maps: no other column counts, whatever it refuses', async () => {
    const others = [
      column('slug', { refusing: true }),
      column('created_at', { refusing: true }),
      column('tenant_id', { refusing: true }),
    ];
    const traces = new PostgresTraceColumns(
      aDatabase([...held, ...others], { valid: true, definition: WHOLE }).run,
      () => target,
    );

    expect(await traces.state()).toEqual({
      table: 'agenda',
      exists: true,
      refusing: [],
      unfit: [],
      row: ['status', 'startsAt'],
      deleted: 'deleted',
      constraint: { state: 'held', columns: ['status', 'startsAt'] },
    });
  });

  it('names the mapped columns nothing can open: a part of the primary key, an identity, a generated column, one that is not there', async () => {
    const kinds = [
      column('id', { key: true }),
      column('region', { refusing: true, key: true }),
      column('serial', { refusing: true, identity: true }),
      column('upper', { generated: true }),
      column('title', { refusing: true }),
    ];
    const data = ['region', 'serial', 'upper', 'gone', 'title'];
    const traces = new PostgresTraceColumns(aDatabase(kinds).run, () => ({
      table: 'agenda',
      data,
      deleted: 'removed',
    }));

    expect(await traces.state()).toMatchObject({
      refusing: ['title'],
      unfit: [
        { column: 'region', because: 'primary-key' },
        { column: 'serial', because: 'identity' },
        { column: 'upper', because: 'generated' },
        { column: 'gone', because: 'absent' },
      ],
      row: ['title'],
      deleted: 'removed',
    });

    await expect(traces.require()).rejects.toThrow('"region" is part of the primary key');
  });

  it('says of a table the database does not hold that it is not there, without asking for its constraint', async () => {
    const { statements, run } = aDatabase([]);
    const traces = new PostgresTraceColumns(run, () => target);

    expect(await traces.state()).toEqual({
      table: 'agenda',
      exists: false,
      refusing: [],
      unfit: [],
      row: [],
      deleted: 'deleted',
    });
    await expect(traces.require()).rejects.toThrow('it is not in this database');
    expect(statements).toHaveLength(2);
  });

  it('reads what the constraint keeps whole: validated or not, or a check of something else', async () => {
    const constraintOf = async (definition: string, valid = true, deleted = 'deleted') =>
      (
        await new PostgresTraceColumns(aDatabase(held, { valid, definition }).run, () => ({
          ...target,
          deleted,
        })).state()
      ).constraint;

    expect(await constraintOf(`${WHOLE} NOT VALID`, false)).toEqual({
      state: 'not-valid',
      columns: ['status', 'startsAt'],
    });
    expect(await constraintOf('CHECK (("was ""removed""" OR (status IS NOT NULL)))', true, 'was "removed"')).toEqual({
      state: 'held',
      columns: ['status'],
    });

    for (const other of [
      "CHECK ((status <> ''::text))",
      WHOLE.replace('deleted', 'removed'),
      'CHECK ((deleted OR (status IS NOT NULL) OR (note IS NULL)))',
      'CHECK ((deleted OR (status IS NULL)))',
    ]) {
      expect(await constraintOf(other)).toEqual({ state: 'unexpected', columns: [], definition: other });
    }
  });
});

interface RoomRow {
  readonly id: string;
}

describe('ReadModelTables', () => {
  const listed = (...states: readonly (ReadModelTableState | Error | undefined)[]) =>
    new ReadModelTables(
      states.map((state) => () => {
        if (state instanceof Error) {
          throw state;
        }

        return { tableState: async () => state };
      }),
    );

  const CONTACTS: ReadModelTableState = {
    ...AGENDA,
    schema: 'notification',
    table: 'contacts',
    refusing: ['address'],
    row: ['address'],
  };

  it('reads each listed table by its own store, in the order of the list, and names those that are not ready', async () => {
    const tables = listed(READY, CONTACTS, AGENDA);

    expect(await tables.states()).toEqual([READY, CONTACTS, AGENDA]);
    expect(await tables.notReady()).toEqual([CONTACTS, AGENDA]);
    await listed(READY).require();
  });

  it('takes the refusal of a store that cannot be built as the state of its table, and lets any other failure through', async () => {
    const { constraint: unread, ...defined } = AGENDA;

    expect(unread).toBeDefined();
    expect(await listed(new ReadModelTableNotReadyError(defined), READY).notReady()).toEqual([defined]);
    await expect(listed(new TypeError('no entity')).states()).rejects.toThrow('no entity');
  });

  it('has nothing to say of a read model that is not kept in a table, nor of an empty list', async () => {
    const inMemory = new InMemoryReadModelStore(
      defineCriteria<RoomRow>({ fields: { id: { type: 'string', sortable: true } }, tieBreaker: 'id' }),
    );
    const logger = new InMemoryLogger();

    expect(await new ReadModelTables([() => inMemory, () => inMemory.table]).states()).toEqual([]);
    expect(await listed(undefined).states()).toEqual([]);

    await listed().atStart(logger);
    await listed().require();

    expect(logger.entries).toEqual([]);
    expect(await listed().report()).toEqual({
      ready: true,
      text: 'No read model table is listed: nothing was checked.',
    });
  });

  it('refuses with one error that names every table and writes the migration of each', async () => {
    const refusal = await listed(CONTACTS, AGENDA)
      .require()
      .catch((error: unknown) => error);

    expect(refusal).toBeInstanceOf(ReadModelTablesNotReadyError);
    expect(refusal).toMatchObject({
      name: 'ReadModelTablesNotReadyError',
      tables: [{ state: CONTACTS }, { state: AGENDA }],
    });

    const { message } = refusal instanceof Error ? refusal : new Error('not refused');

    expect(message.split('\n\n')).toEqual([
      '2 read model tables are not ready for this version: notification.contacts, scheduling.agenda. Apply the migrations of the project before the application starts; a table they leave as it is takes the migration written under its name.',
      new ReadModelTableNotReadyError(CONTACTS).message,
      new ReadModelTableNotReadyError(AGENDA).message,
    ]);

    expect(new ReadModelTablesNotReadyError([AGENDA]).message).toContain('1 read model table is not ready');
  });

  it('refuses the start of an application by default, and logs nothing', async () => {
    const logger = new InMemoryLogger();

    await expect(listed(AGENDA).atStart(logger)).rejects.toThrow(ReadModelTablesNotReadyError);
    await listed(READY).atStart(logger);
    await listed(READY).atStart(logger, 'reported');

    expect(logger.entries).toEqual([]);
  });

  it('reports the tables as one error and lets the start go on, when the application asks for it', async () => {
    const logger = new InMemoryLogger();

    await listed(READY, CONTACTS, AGENDA).atStart(logger, 'reported');

    expect(logger.entries).toEqual([
      {
        level: 'error',
        message: expect.stringContaining('2 read model tables are not ready for this version'),
        fields: { tables: 'notification.contacts, scheduling.agenda' },
      },
    ]);
  });

  const UNVALIDATED: ReadModelTableState = { ...READY, constraint: { state: 'not-valid', columns: ['note'] } };
  const OTHER: ReadModelTableState = {
    ...READY,
    schema: undefined,
    table: 'rooms',
    constraint: { state: 'unexpected', columns: [], definition: 'CHECK ((1 = 1))' },
  };

  const NOTES = [
    'The check constraint outcomes_live_rows_whole of scheduling.outcomes is not validated: the rows written before it are not held to it. Run: alter table "scheduling"."outcomes" validate constraint "outcomes_live_rows_whole";',
    'The check constraint rooms_live_rows_whole of rooms does not read as "deleted or (<column> is not null and ...)": CHECK ((1 = 1)). It is left as it is.',
  ];

  it('warns of a constraint that is not validated or checks something else, and starts: such a table holds a trace', async () => {
    const logger = new InMemoryLogger();

    await listed(UNVALIDATED, OTHER).atStart(logger);

    expect(logger.entries.map(({ level, message }) => [level, message])).toEqual(NOTES.map((note) => ['warn', note]));
  });

  it('reports as a command prints it: how many tables it read and their names, the warnings, then the refusals', async () => {
    expect(await listed(READY).report()).toEqual({
      ready: true,
      text: 'Checked 1 read model table: scheduling.outcomes.\nEach can hold the trace of a deleted row.',
    });

    expect(await listed(UNVALIDATED, OTHER, AGENDA).report()).toEqual({
      ready: false,
      text: [
        'Checked 3 read model tables: scheduling.outcomes, rooms, scheduling.agenda.',
        ...NOTES,
        '',
        new ReadModelTablesNotReadyError([AGENDA]).message,
      ].join('\n'),
    });
  });
});
