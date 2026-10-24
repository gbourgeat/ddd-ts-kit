import type { Knex } from 'knex';
import { expiredBefore, type ExecutionScope } from '@ddd-ts-kit/kernel';
import { tableIn } from '../tenancy/table-in';
import { TENANT_COLUMN } from '../tenancy/where-tenant';
import type { KnexContext } from '../unit-of-work/knex-context';
import type { KnexPersonalFields } from './knex-personal-fields';

/**
 * The rows of a declared table whose retention ended before `now`: their date column is earlier
 * than the end of the period, a row whose date is empty never expires. In the tenant of the work
 * when it names one, in every tenant when it names none: a purge is a policy of the table, run by
 * the platform, and a tenant left out of a list would keep what it should not. A function and not
 * a method, as `rowsAbout`: a query builder is thenable.
 */
export function rowsExpired(
  context: KnexContext,
  declaration: KnexPersonalFields,
  { now, tenant }: { readonly now: Date; readonly tenant: ExecutionScope | undefined },
): Knex.QueryBuilder {
  const { retention } = declaration;

  if (retention === undefined) {
    throw new Error(`The declaration of ${declaration.table.table} gives no retention to purge by`);
  }

  const rows = tableIn(context, declaration.table).where(retention.after, '<', expiredBefore(retention, now));
  const tenantId = tenant?.current()?.tenantId;

  return tenantId === undefined ? rows : rows.where(declaration.table.column ?? TENANT_COLUMN, tenantId);
}
