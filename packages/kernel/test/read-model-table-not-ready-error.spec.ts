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

/** The two statements of the second step of the agenda. */
const VALIDATED = 'alter table "scheduling"."agenda" validate constraint "agenda_live_rows_whole";';

const FORM =
  '^CHECK [(][(]("([^"]|"")+"|[a-z_][a-z0-9_]*) OR ([(]("([^"]|"")+"|[a-z_][a-z0-9_]*) IS NOT NULL[)]|[(][(]("([^"]|"")+"|[a-z_][a-z0-9_]*) IS NOT NULL[)]( AND [(]("([^"]|"")+"|[a-z_][a-z0-9_]*) IS NOT NULL[)])+[)])[)][)]( NOT VALID|)$';

/** The change of definition as one statement: the constraint of that name read first, then NOT NULL dropped and the constraint written. */
const rewritten = (path: string, table: string, changed: string) =>
  [
    'do $kit$',
    'begin',
    `  if exists (select 1 from pg_constraint where conrelid = to_regclass('${path}') and conname = '${table}_live_rows_whole' and pg_get_constraintdef(oid) !~ '${FORM}') then`,
    "    raise exception 'A constraint named as the one that keeps the live rows of a read model whole checks something else: it is left as it is.';",
    '  end if;',
    `  alter table ${path} ${changed} not valid;`,
    'end',
    '$kit$;',
  ].join('\n');

describe('ReadModelTableNotReadyError', () => {
  it('names the table, the column that refuses NULL, the missing constraint and the migration to write in two steps', () => {
    const error = new ReadModelTableNotReadyError(AGENDA);

    expect(error.name).toBe('ReadModelTableNotReadyError');
    expect(error.table).toBe('scheduling.agenda');
    expect(error.columns).toEqual(['starts_at']);
    expect(error.state).toBe(AGENDA);

    expect(error.steps).toEqual({
      definition: [
        rewritten(
          '"scheduling"."agenda"',
          'agenda',
          'alter column "starts_at" drop not null, drop constraint if exists "agenda_live_rows_whole", add constraint "agenda_live_rows_whole" check ("deleted" or ("starts_at" is not null))',
        ),
      ],
      validation: [VALIDATED, AGENDA_EMPTIED],
    });

    expect(error.statements).toEqual([...error.steps.definition, VALIDATED, AGENDA_EMPTIED]);

    // A placeholder of knex.raw or an escape a string of JavaScript eats would change the statement in a migration file.
    expect(error.statements.join('\n')).not.toMatch(/[?\\]/);

    expect(error.message).toBe(
      [
        'The read model table scheduling.agenda cannot hold the trace of a deleted row: "starts_at" refuses NULL. A deleted row keeps its key, its tenant and its stamp only. The check constraint agenda_live_rows_whole, which keeps the live rows whole, is missing. The migration to write:',
        '-- The change of definition: brief, under the lock that stops the readers and the writers of the table.',
        ...error.steps.definition,
        '-- Then the validation of the constraint and the cleaning of the rows deleted before, which reads the whole table: in the same migration on a small table; on a large one, in a migration that runs outside the transaction of the change of definition, where it stops neither readers nor writers.',
        VALIDATED,
        AGENDA_EMPTIED,
      ].join('\n'),
    );
  });

  it('names every column when several refuse NULL, a table without a schema as it stands, a quote doubled', () => {
    const error = new ReadModelTableNotReadyError({
      table: "o'rder",
      exists: true,
      refusing: ['a', 'b'],
      unfit: [],
      row: ['a', 'b'],
      deleted: 'removed',
      constraint: { state: 'missing', columns: [] },
    });

    expect(error.table).toBe("o'rder");
    expect(error.message).toContain('"a", "b" refuse NULL');
    expect(error.statements[0]).toContain(`to_regclass('"o''rder"') and conname = 'o''rder_live_rows_whole'`);

    expect(error.statements[0]).toContain(
      `alter table "o'rder" alter column "a" drop not null, alter column "b" drop not null, drop constraint if exists "o'rder_live_rows_whole", add constraint "o'rder_live_rows_whole" check ("removed" or ("a" is not null and "b" is not null)) not valid;`,
    );

    expect(error.statements[2]).toBe(
      `update "o'rder" set "a" = null, "b" = null where "removed" and ("a" is not null or "b" is not null);`,
    );
  });
});

describe('readModelTableMigration', () => {
  it('writes a constraint again with the columns it held, leaves one that holds them, and validates one that is not', () => {
    const held = (columns: string[], found: 'held' | 'not-valid' = 'held') =>
      readModelTableMigration({ ...AGENDA, constraint: { state: found, columns } });

    expect(held(['note']).definition[0]).toContain(
      'check ("deleted" or ("note" is not null and "starts_at" is not null)) not valid;',
    );

    expect(held(['starts_at'])).toEqual({ definition: [AGENDA_OPENED], validation: [AGENDA_EMPTIED] });

    expect(held(['starts_at'], 'not-valid')).toEqual({
      definition: [AGENDA_OPENED],
      validation: [VALIDATED, AGENDA_EMPTIED],
    });

    expect(readModelTableMigration({ ...READY, constraint: { state: 'not-valid', columns: ['note'] } })).toEqual({
      definition: [],
      validation: ['alter table "scheduling"."outcomes" validate constraint "outcomes_live_rows_whole";'],
    });

    expect(readModelTableMigration(READY)).toEqual({ definition: [], validation: [] });
  });

  it('names in the note of the second step what that step holds, and no validation where it has none', () => {
    const cleaning = new ReadModelTableNotReadyError({
      ...AGENDA,
      constraint: { state: 'held', columns: ['starts_at'] },
    });

    expect(cleaning.message).toContain('-- Then the cleaning of the rows deleted before, which reads the whole table');
    expect(cleaning.message).not.toContain('validat');
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

const AGENDA_EMPTIED =
  'update "scheduling"."agenda" set "starts_at" = null, "note" = null where "deleted" and ("starts_at" is not null or "note" is not null);';
