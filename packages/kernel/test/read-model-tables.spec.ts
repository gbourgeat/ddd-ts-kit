import { describe, expect, it } from 'vitest';
import {
  InMemoryLogger,
  InMemoryReadModelStore,
  ReadModelTableNotReadyError,
  ReadModelTables,
  ReadModelTablesNotReadyError,
  defineCriteria,
  type ReadModelTableState,
} from '../src';

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

interface RoomRow {
  readonly id: string;
}

/** The entries of a list, named `Store1`, `Store2`, ..: a state is read, an error is what building the store throws. */
const entries = (...states: readonly (ReadModelTableState | Error | undefined)[]) =>
  states.map((state, index) => ({
    name: `Store${String(index + 1)}`,
    build: () => {
      if (state instanceof Error) {
        throw state;
      }

      return { tableState: async () => state };
    },
  }));

const listed = (...states: readonly (ReadModelTableState | Error | undefined)[]) =>
  new ReadModelTables(entries(...states));

const CONTACTS: ReadModelTableState = {
  ...AGENDA,
  schema: 'notification',
  table: 'contacts',
  refusing: ['address'],
  row: ['address'],
};

describe('ReadModelTables', () => {
  it('reads each listed table by its own store, in the order of the list, and names those that are not ready', async () => {
    const tables = listed(READY, CONTACTS, AGENDA);

    expect(await tables.states()).toEqual([READY, CONTACTS, AGENDA]);
    expect(await tables.notReady()).toEqual([CONTACTS, AGENDA]);
    await listed(READY).require();
  });

  it('takes the refusal of a store that cannot be built as the state of its table', async () => {
    const { constraint: unread, ...defined } = AGENDA;

    expect(unread).toBeDefined();
    expect(await listed(new ReadModelTableNotReadyError(defined), READY).notReady()).toEqual([defined]);
  });

  it('tries every entry: one that cannot be built or read is told under its name with its cause, the others still read', async () => {
    const denied = { name: 'KnexLedger', build: () => ({ tableState: () => Promise.reject('permission denied') }) };
    const tables = new ReadModelTables([...entries(new TypeError('no entity'), READY, AGENDA), denied]);
    const logger = new InMemoryLogger();

    expect(await tables.states()).toEqual([READY, AGENDA]);

    const refusal = await tables.require().catch((error: unknown) => error);

    expect(refusal).toMatchObject({
      tables: [{ state: AGENDA }],
      unread: [{ name: 'Store1' }, { name: 'KnexLedger', cause: 'permission denied' }],
    });

    expect(refusal instanceof Error ? refusal.message.split('\n\n')[1] : '').toBe(
      'The tables of 2 read models could not be read, so nothing says whether a trace is taken: Store1 (no entity); KnexLedger (permission denied).',
    );

    await expect(tables.atStart(logger)).rejects.toThrow(ReadModelTablesNotReadyError);
    await tables.atStart(logger, 'reported');

    expect(logger.entries.map(({ level, fields }) => [level, fields])).toEqual([
      ['error', { tables: 'scheduling.agenda', unread: 'Store1, KnexLedger' }],
    ]);

    expect((await tables.report()).ready).toBe(false);

    const one = await new ReadModelTables(entries(new Error('down'))).report();

    expect(one.text).toBe(
      'No listed read model keeps a table that could be read.\n\nThe table of 1 read model could not be read, so nothing says whether a trace is taken: Store1 (down).',
    );
  });

  it('has nothing to say of a read model that is not kept in a table, nor of an empty list', async () => {
    const inMemory = new InMemoryReadModelStore(
      defineCriteria<RoomRow>({ fields: { id: { type: 'string', sortable: true } }, tieBreaker: 'id' }),
    );

    const logger = new InMemoryLogger();

    expect(
      await new ReadModelTables([
        { name: 'Rooms', build: () => inMemory },
        { name: 'RoomsTable', build: () => inMemory.table },
      ]).states(),
    ).toEqual([]);

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
        fields: { tables: 'notification.contacts, scheduling.agenda', unread: '' },
      },
    ]);
  });
});

const UNVALIDATED: ReadModelTableState = { ...READY, constraint: { state: 'not-valid', columns: ['note'] } };

const OTHER: ReadModelTableState = {
  table: 'rooms',
  exists: true,
  refusing: [],
  unfit: [],
  row: ['starts_at', 'note'],
  deleted: 'deleted',
  constraint: { state: 'unexpected', columns: [], definition: 'CHECK ((1 = 1))' },
};

const NOTES = [
  'The check constraint outcomes_live_rows_whole of scheduling.outcomes is not validated: the rows written before it are not held to it. Run: alter table "scheduling"."outcomes" validate constraint "outcomes_live_rows_whole";',
  'The check constraint rooms_live_rows_whole of rooms is not written as the kit writes it, "deleted or (<column> is not null and ...)": CHECK ((1 = 1)). It is left as it is, and nothing says whether it lets a trace in.',
];

const DOUBTED: ReadModelTableState = {
  ...READY,
  table: 'ledger',
  relation: 'materialized-view',
  checks: [
    { name: 'ledger_noted', definition: 'CHECK ((note IS NOT NULL))' },
    { name: 'ledger_dated', definition: 'CHECK ((starts_at > 0))' },
  ],
};

const DOUBTS = [
  'Other check constraints of scheduling.ledger name a column of its row: ledger_noted CHECK ((note IS NOT NULL)); ledger_dated CHECK ((starts_at > 0)). One that refuses NULL there refuses the trace of a deleted row: make it hold for the live rows only ("deleted or ...").',
  'scheduling.ledger is a materialized view, not a table: what its base columns refuse is not read, so nothing says whether a trace is taken.',
  'Read model stores of the application are not listed, so nothing checks their tables: KnexLedger, KnexRooms. Add each to the list of the read model tables.',
];

describe('ReadModelTables: what a start warns of and what a command prints', () => {
  it('warns of a constraint that is not validated or checks something else, and starts: such a table holds a trace', async () => {
    const logger = new InMemoryLogger();

    await listed(UNVALIDATED, OTHER).atStart(logger);

    expect(logger.entries.map(({ level, message }) => [level, message])).toEqual(NOTES.map((note) => ['warn', note]));
  });

  it('warns of what it does not read: another check on a column of the row, a view, a store nobody lists', async () => {
    const logger = new InMemoryLogger();
    const tables = new ReadModelTables(entries(DOUBTED), ['KnexLedger', 'KnexRooms']);

    await tables.atStart(logger);

    expect(logger.entries.map(({ level, message }) => [level, message])).toEqual(DOUBTS.map((note) => ['warn', note]));

    expect(await new ReadModelTables([], ['KnexLedger', 'KnexRooms']).report()).toEqual({
      ready: true,
      text: `No read model table is listed: nothing was checked.\n${String(DOUBTS[2])}`,
    });
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
