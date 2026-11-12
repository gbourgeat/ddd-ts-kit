import { liveRowsConstraintOf } from './live-rows-constraint-of';
import { readModelTableMigration } from './read-model-table-migration';
import type { ReadModelTableState } from '../../application/read-model/read-model-table-state';

/**
 * The table of a read model cannot hold the trace of a deleted row: its key, its tenant and its
 * stamp, NULL in every other column the store maps. An adapter raises it from the definition of
 * the table when the store is built, or from one read of its columns before the first trace,
 * never from a statement the database would refuse, since on PostgreSQL that refusal aborts the
 * transaction of the event. Its message names the table, what keeps it from holding a trace,
 * what is known of the check constraint of the live rows, and the migration to write, which
 * names the columns the store maps and no other.
 */
export class ReadModelTableNotReadyError extends Error {
  /** The table as it is said: `scheduling.agenda`. */
  readonly table: string;

  /** The columns of the row that refuse NULL. */
  readonly columns: readonly string[];

  /** The migration to write, one statement per entry; none when no migration makes the table ready. */
  readonly statements: readonly string[];

  constructor(readonly state: ReadModelTableState) {
    const table = state.schema === undefined ? state.table : `${state.schema}.${state.table}`;
    const statements = readModelTableMigration(state);

    super(
      [
        `The read model table ${table} cannot hold the trace of a deleted row: ${reasonsOf(state).join('; ')}.`,
        ...adviceOf(state, table),
        ...migrationOf(statements),
      ].join(' '),
    );

    this.name = 'ReadModelTableNotReadyError';
    this.table = table;
    this.columns = state.refusing;
    this.statements = statements;
  }
}

const UNFIT = {
  'primary-key': 'is part of the primary key',
  identity: 'is an identity column',
  generated: 'is a generated column',
  absent: 'is not a column of the table',
};

function reasonsOf({ exists, refusing, unfit }: ReadModelTableState): string[] {
  if (!exists) {
    return ['it is not in this database'];
  }

  const named = refusing.map((column) => `"${column}"`).join(', ');

  return [
    ...(refusing.length === 0 ? [] : [`${named} ${refusing.length === 1 ? 'refuses' : 'refuse'} NULL`]),
    ...unfit.map(({ column, because }) => `"${column}" ${UNFIT[because]}`),
  ];
}

/** What to do about each reason, and what is known of the check constraint that keeps the live rows whole. */
function adviceOf(state: ReadModelTableState, table: string): string[] {
  const { exists, refusing, unfit, constraint } = state;
  const name = liveRowsConstraintOf(state.table);

  if (!exists) {
    return ['The migration that creates it did not run on this database: apply the migrations of the project.'];
  }

  return [
    'A deleted row keeps its key, its tenant and its stamp only.',
    ...(unfit.length === 0
      ? []
      : [
          'No migration opens a column of that kind: a store maps as a field of the row only a plain column, which a trace can hold NULL in. Take it out of the columns the store maps, or make it one.',
        ]),
    ...(refusing.length > 0 && constraint === undefined
      ? [
          `The definition the store reads says so: declare these columns nullable there, with the check constraint ${name} that keeps the live rows whole; the store then reads what ${table} needs in the database.`,
        ]
      : []),
    ...(refusing.length > 0 && constraint?.state === 'missing'
      ? [`The check constraint ${name}, which keeps the live rows whole, is missing.`]
      : []),
    ...(refusing.length > 0 && constraint?.state === 'unexpected'
      ? [
          `A constraint ${name} is there and checks something else (${String(constraint.definition)}): the migration leaves it as it is, write by hand what keeps these columns whole in the live rows.`,
        ]
      : []),
  ];
}

function migrationOf(statements: readonly string[]): string[] {
  if (statements.length === 0) {
    return [];
  }

  return [
    `The migration to write:\n${statements.join('\n')}\n-- On a large table, run "validate constraint" in a transaction of its own (it then scans without stopping readers nor writers) and the update by ranges of the key: it rewrites only the deleted rows that still hold data.`,
  ];
}
