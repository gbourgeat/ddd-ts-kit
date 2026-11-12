import { liveRowsConstraintOf } from './live-rows-constraint-of';
import { readModelTableMigration } from './read-model-table-migration';
import type { ReadModelTableState } from '../../application/read-model/read-model-table-state';

/**
 * What is said, as a warning, of a table the check does not refuse and cannot vouch for: its
 * check constraint is not validated, or a constraint of that name checks something else; another
 * check constraint names a column of its row and may refuse the NULL of a trace; it is a view,
 * whose base columns are not read.
 */
export function readModelTableNotes(state: ReadModelTableState): string[] {
  const name = liveRowsConstraintOf(state.table);
  const table = state.schema === undefined ? state.table : `${state.schema}.${state.table}`;
  const others = (state.checks ?? []).map((check) => `${check.name} ${check.definition}`);

  return [
    ...(state.constraint?.state === 'not-valid'
      ? [
          `The check constraint ${name} of ${table} is not validated: the rows written before it are not held to it. Run: ${readModelTableMigration(state).validation.join(' ')}`,
        ]
      : []),
    ...(state.constraint?.state === 'unexpected'
      ? [
          `The check constraint ${name} of ${table} is not written as the kit writes it, "deleted or (<column> is not null and ...)": ${String(state.constraint.definition)}. It is left as it is, and nothing says whether it lets a trace in.`,
        ]
      : []),
    ...(others.length === 0
      ? []
      : [
          `Other check constraints of ${table} name a column of its row: ${others.join('; ')}. One that refuses NULL there refuses the trace of a deleted row: written for the live rows only ("deleted or ..."), it lets every trace in and is no longer named here.`,
        ]),
    ...(state.relation === undefined
      ? []
      : [
          `${table} is a ${state.relation.replace('-', ' ')}, not a table: what its base columns refuse is not read, so nothing says whether a trace is taken.`,
        ]),
  ];
}
