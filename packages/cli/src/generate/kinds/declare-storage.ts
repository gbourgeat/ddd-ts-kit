import type { Name } from '../../naming';
import type { RenderContext } from '../../templating';
import type { Scope } from '../scope';
import { declareTable } from './declare-table';

const AGGREGATE_TABLE =
  'The generator declares a table once: change it by hand in <file>. Personal columns the table holds are then declared by `ddd-ts-kit generate personal-fields <context> <table> --personal <column>,... --subject <column>`, or, when the table has its *.personal-fields.ts already, by a line in its fields.';

/** The table or model of the aggregate, declared where the migration tooling of the ORM reads it. */
export function declareStorage(scope: Scope, aggregate: Name, context: RenderContext): void {
  declareTable(scope, context, { table: aggregate.table, templates: 'repository', changedBy: AGGREGATE_TABLE });
}
