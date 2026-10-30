import type { Knex } from 'knex';
import { tenantScopeOf, type ExecutionScope } from '@ddd-ts-kit/kernel';
import type { KnexContext } from '../unit-of-work/knex-context';
import { conjunctBuilder } from './conjunct-builder';
import { tableIn } from './table-in';
import type { TenantTableTarget } from './tenant-table-target';
import { TENANT_COLUMN } from './where-tenant';

/**
 * The rows of the one tenant of the work in progress, for an update or a delete: an elevation
 * widens reads, never writes. An insert spreads `tenantRow(tenantScopeOf(scope))` into its row.
 * An `or` at the top of the statement is refused, as on `whereTenant`: alternatives go in a group.
 */
export function ownTenantTable<Row extends object>(
  context: KnexContext,
  scope: ExecutionScope,
  target: TenantTableTarget,
): Knex.QueryBuilder<Row, Row[]> {
  return conjunctBuilder(
    tableIn<Row>(context, target).where(target.column ?? TENANT_COLUMN, tenantScopeOf(scope).tenantId),
  );
}
