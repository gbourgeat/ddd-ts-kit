import type { Name } from '../../naming';
import type { RenderContext } from '../../templating';
import type { Scope } from '../scope';
import { declareTable } from './declare-table';

const AGGREGATE_TABLE =
  'Change the table by hand in <file>, a personal field with its line in the *.personal-fields.ts of the aggregate; the generator declares a table once.';

/** The table or model of the aggregate, declared where the migration tooling of the ORM reads it. */
export function declareStorage(scope: Scope, aggregate: Name, context: RenderContext): void {
  declareTable(scope, context, { table: aggregate.table, templates: 'repository', changedBy: AGGREGATE_TABLE });
}
