import { getTableColumns, sql, type SQL } from 'drizzle-orm';
import { getTableConfig } from 'drizzle-orm/pg-core';
import { expiredBefore } from '@ddd-ts-kit/kernel';
import { columnOf } from '../read-model/column-of';
import type { DrizzleErasureTenant } from './drizzle-personal-data-erasure-options';
import type { DrizzlePersonalFields } from './drizzle-personal-fields';
import { named } from './named';
import { tenantColumnOf } from './tenant-column-of';

/**
 * The rows of a declared table whose retention ended before `now`: their date column is earlier
 * than the end of the period, a row whose date is empty never expires. In the tenant of the work
 * when it names one, in every tenant when it names none: a purge is a policy of the table, run by
 * the platform, and a tenant left out of a list would keep what it should not.
 */
export function expiredRows(
  declaration: DrizzlePersonalFields,
  { now, tenant }: { readonly now: Date; readonly tenant: DrizzleErasureTenant | undefined },
): SQL {
  const { retention } = declaration;

  if (retention === undefined) {
    throw new Error(`The declaration of ${getTableConfig(declaration.table).name} gives no retention to purge by`);
  }

  const columns = getTableColumns(declaration.table);
  const expired = sql`${named(columnOf(columns, retention.after))} < ${expiredBefore(retention, now)}`;
  const tenantId = tenant?.scope.current()?.tenantId;

  if (tenant === undefined || tenantId === undefined) {
    return expired;
  }

  return sql`${expired} and ${named(tenantColumnOf(columns, tenant.column ?? 'tenant_id', declaration))} = ${tenantId}`;
}
