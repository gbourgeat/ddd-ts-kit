import { describe, expect, it } from 'vitest';
import { ReadModelTableNotReadyError, type ReadModelTableState } from '../src';
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
});

describe('liveRowsConstraintOf', () => {
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
