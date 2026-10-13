import type { Knex } from 'knex';
import { tenantScopeOf, type ExecutionScope } from '@ddd-ts-kit/kernel';
import type { KnexContext } from '../unit-of-work/knex-context.js';
import { tableIn } from './table-in.js';
import type { TenantTableTarget } from './tenant-table-target.js';
import { TENANT_COLUMN } from './where-tenant.js';

/**
 * The rows of the one tenant of the work in progress, for an update or a delete: an elevation
 * widens reads, never writes. An insert spreads `tenantRow(tenantScopeOf(scope))` into its row.
 */
export function ownTenantTable<Row extends object>(
  context: KnexContext,
  scope: ExecutionScope,
  target: TenantTableTarget,
): Knex.QueryBuilder<Row, Row[]> {
  return tableIn<Row>(context, target).where(target.column ?? TENANT_COLUMN, tenantScopeOf(scope).tenantId);
}
