import { getTableColumns, sql, type SQL } from 'drizzle-orm';
import { tenantScopeOf } from '@ddd-ts-kit/kernel';
import { columnOf } from '../read-model/column-of';
import type { DrizzleErasureTenant } from './drizzle-personal-data-erasure-options';
import type { DrizzlePersonalFields } from './drizzle-personal-fields';
import { named } from './named';
import { tenantColumnOf } from './tenant-column-of';

const TENANT_COLUMN = 'tenant_id';

/** The rows about the subject, in the tenant of the work when the table holds tenant data. */
export function aboutSubject(
  declaration: DrizzlePersonalFields,
  subject: string,
  tenant: DrizzleErasureTenant | undefined,
): SQL {
  const columns = getTableColumns(declaration.table);
  const subjectColumn = named(columnOf(columns, declaration.subject));

  if (tenant === undefined) {
    return sql`${subjectColumn} = ${subject}`;
  }

  const tenantColumn = tenantColumnOf(columns, tenant.column ?? TENANT_COLUMN, declaration);

  return sql`${subjectColumn} = ${subject} and ${named(tenantColumn)} = ${tenantScopeOf(tenant.scope).tenantId}`;
}
