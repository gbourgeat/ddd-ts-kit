import type { Knex } from 'knex';
import type { ExecutionScope } from '@ddd-ts-kit/kernel';
import type { KnexContext } from '../unit-of-work/knex-context';
import { tableIn } from './table-in';
import type { TenantTableTarget } from './tenant-table-target';
import { whereTenant } from './where-tenant';

/**
 * The rows of a table of tenant data that a read may reach, on the executor of the unit of
 * work: those of the tenant of the work, or of the tenants of an elevation. The one way a
 * repository of a tenant-scoped project reads (`tenancy/scoped-statement`). Writes go through
 * `ownTenantTable`, which an elevation does not widen.
 */
export function tenantTable<Row extends object>(
  context: KnexContext,
  scope: ExecutionScope,
  target: TenantTableTarget,
): Knex.QueryBuilder<Row, Row[]> {
  return whereTenant(tableIn<Row>(context, target), scope, target.column);
}
