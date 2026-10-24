import { getTableColumns, sql, type SQL } from 'drizzle-orm';
import { getTableConfig, type PgColumn } from 'drizzle-orm/pg-core';
import { tenantScopeOf } from '@ddd-ts-kit/kernel';
import { columnOf } from '../read-model/column-of';
import type { DrizzleErasureTenant } from './drizzle-personal-data-erasure-options';
import type { DrizzlePersonalFields } from './drizzle-personal-fields';
import { named } from './named';

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

function tenantColumnOf(
  columns: Readonly<Record<string, PgColumn>>,
  name: string,
  declaration: DrizzlePersonalFields,
): PgColumn {
  const column = Object.values(columns).find((candidate) => candidate.name === name);

  if (column === undefined) {
    throw new Error(
      `The table ${getTableConfig(declaration.table).name} has no column "${name}": a table of tenant data names its tenant in it, or the erasure is given the column`,
    );
  }

  return column;
}
