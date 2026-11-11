import { CliError } from '../../../cli-error';
import { personalColumn, type PersonalColumn } from './personal-column';
import type { PersonalRequest } from './personal-request-of';
import type { FoundTable } from './table-of-schema';

/** The columns a request names, as the table spells them, and the ones its definition did not let the generator read. */
export interface ColumnsOfTable {
  readonly columnOf: (column: string) => PersonalColumn;
  /** Named by the request and not found in a definition that takes columns from elsewhere: said in the output, to check by hand. */
  readonly unread: readonly string[];
}

const TENANT_COLUMN = 'tenant_id';

/**
 * Every column `--personal`, `--subject` and `--retention` name, looked up in the definition of
 * the table: the generator adds no column to a table of the project. One the definition does not
 * hold is refused; when the definition takes columns from elsewhere (a spread, a helper), what
 * it does not name may still be there, and is answered as unread. A table whose erasure is
 * confined to the tenant of the work holds `tenant_id` too.
 */
export function columnsOfTable(found: FoundTable, request: PersonalRequest, tenantScoped: boolean): ColumnsOfTable {
  const { table } = found;
  const held = (column: string): PersonalColumn | undefined => table.columns.find((one) => one.column === column);
  const dated = request.retention === undefined ? [] : [request.retention.column];
  const missing = [...request.fields, request.subject, ...dated].filter((column) => held(column) === undefined);

  if (missing.length > 0 && !table.open) {
    throw absent(found, missing);
  }

  if (tenantScoped && !table.open && held(TENANT_COLUMN) === undefined) {
    throw withoutTenant(found);
  }

  return { columnOf: (column) => held(column) ?? personalColumn(column), unread: missing };
}

function absent({ table, file }: FoundTable, missing: readonly string[]): CliError {
  const columns = table.columns.map((one) => one.column);

  return new CliError(
    `The table ${table.name} of ${file} holds no column ${missing.join(', ')}.`,
    `This generator declares the columns a table has, it adds none: name the columns as the database spells them (${[...new Set(columns)].join(', ')}), or add the column to the table in ${file} first, with its migration.`,
  );
}

function withoutTenant({ table, file }: FoundTable): CliError {
  return new CliError(
    `The table ${table.name} of ${file} holds no column ${TENANT_COLUMN}, and the erasure of this context confines every statement to the tenant of the work.`,
    `Add the tenant column to the table in ${file} (tenantColumn of the ORM package of the kit), with its migration, then run the command again: a table without it cannot be erased tenant by tenant.`,
  );
}
