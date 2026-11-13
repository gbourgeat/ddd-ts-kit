import { describe, expect, it } from 'vitest';
import { PostgresTraceColumns, ReadModelTableNotReadyError } from '../src';

/** A column of the catalog, as the statement of the columns answers it. */
const column = (
  name: string,
  flags: {
    refusing?: boolean;
    key?: boolean;
    identity?: boolean;
    generated?: boolean;
    domain?: boolean;
    relation?: string;
  } = {},
) => ({
  column: name,
  refusing: false,
  key: false,
  identity: false,
  generated: false,
  domain: false,
  relation: 'r',
  ...flags,
});

interface Check {
  readonly valid: boolean;
  readonly definition: string;
  /** Default: the name of the kit's constraint, on the columns of the row. */
  readonly name?: string;
  readonly columns?: string;
}

/** A database that holds these columns for the table, and these check constraints, the first under the kit's name. */
function aDatabase(columns: readonly ReturnType<typeof column>[], ...checks: readonly Check[]) {
  const statements: [string, readonly unknown[]][] = [];

  const run = async (statement: string, parameters: readonly unknown[]) => {
    statements.push([statement, parameters]);

    if (statement.includes('pg_constraint')) {
      return checks.map((check) => ({ name: 'agenda_live_rows_whole', columns: '["status"]', ...check }));
    }

    return columns;
  };

  return { statements, run };
}

const WHOLE = 'CHECK ((deleted OR ((status IS NOT NULL) AND ("startsAt" IS NOT NULL))))';

const target = { table: 'agenda', data: ['status', 'startsAt'] };

const held = [
  column('id', { refusing: true, key: true }),
  column('status'),
  column('startsAt'),
  column('last_event_id', { refusing: true }),
];

describe('PostgresTraceColumns', () => {
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
      ['"sched""uling"."agenda"'],
      ['"sched""uling"."agenda"'],
      ['"sched""uling"."agenda"'],
    ]);

    expect(statements[1]?.[0]).toContain(
      "from pg_constraint as con where con.conrelid = to_regclass($1) and con.contype = 'c'",
    );
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
});

describe('PostgresTraceColumns: the constraint of the table', () => {
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

    expect(
      await constraintOf('CHECK ((deleted OR ((a IS NOT NULL) AND ("b ""c"" x" IS NOT NULL) AND (d_1 IS NOT NULL))))'),
    ).toEqual({ state: 'held', columns: ['a', 'b "c" x', 'd_1'] });

    for (const other of [
      "CHECK ((status <> ''::text))",
      WHOLE.replace('deleted', 'removed'),
      'CHECK ((deleted OR (status IS NOT NULL) OR (note IS NULL)))',
      'CHECK ((deleted OR (status IS NULL)))',
      'CHECK (((deleted OR (status IS NOT NULL)) AND (code IS NOT NULL)))',
      'CHECK ((deleted OR (NOT (status IS NOT NULL))))',
      'CHECK ((deleted OR ((status IS NOT NULL) OR (code IS NOT NULL))))',
      'CHECK ((deleted OR (status IS NOT NULL))) NO INHERIT',
    ]) {
      expect(await constraintOf(other)).toEqual({ state: 'unexpected', columns: [], definition: other });
    }
  });

  it('names the other check constraints that name a column of the row, and no other', async () => {
    const { run } = aDatabase(
      held,
      { valid: true, definition: WHOLE },
      {
        name: 'agenda_status_known',
        valid: true,
        definition: "CHECK ((status <> ''::text))",
        columns: '["status","id"]',
      },
      {
        name: 'agenda_stamped',
        valid: true,
        definition: "CHECK ((last_event_id <> ''::text))",
        columns: '["last_event_id"]',
      },
      { name: 'agenda_odd', valid: true, definition: 'CHECK (true)', columns: 'null' },
      // Written for the live rows only, as the warning advises: every trace passes it.
      {
        name: 'agenda_titled',
        valid: true,
        definition: 'CHECK ((deleted OR (length(status) > 0)))',
        columns: '["deleted","status"]',
      },
    );

    const state = await new PostgresTraceColumns(run, () => target).state();

    expect(state.constraint).toEqual({ state: 'held', columns: ['status', 'startsAt'] });
    expect(state.checks).toEqual([{ name: 'agenda_status_known', definition: "CHECK ((status <> ''::text))" }]);
  });

  it('names a column of a domain that refuses NULL as one nothing opens, and a view as what it is', async () => {
    const viewed = [column('status', { domain: true, relation: 'v' }), column('startsAt', { relation: 'v' })];
    const state = await new PostgresTraceColumns(aDatabase(viewed).run, () => target).state();

    expect(state).toMatchObject({
      unfit: [{ column: 'status', because: 'domain' }],
      row: ['startsAt'],
      relation: 'view',
    });

    const kinds = async (relation: string) =>
      (await new PostgresTraceColumns(aDatabase([column('status', { relation })]).run, () => target).state()).relation;

    expect([await kinds('m'), await kinds('f'), await kinds('p')]).toEqual([
      'materialized-view',
      'foreign-table',
      undefined,
    ]);
  });
});
