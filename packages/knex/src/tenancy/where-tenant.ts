import type { Knex } from 'knex';
import { tenantReachOf, type ExecutionScope } from '@ddd-ts-kit/kernel';
import { conjunctBuilder } from './conjunct-builder';

/** The tenant column every table of tenant data has: `tenantColumn` writes it. */
export const TENANT_COLUMN = 'tenant_id';

/**
 * Confines a read to what the work in progress may see (`tenantReachOf`): its tenant, or the
 * tenants of an elevation. Work that names no tenant is refused, never read unscoped. An `or` at
 * the top of the statement is refused too (`UngroupedOrError`): SQL would bind it outside the
 * condition, so alternatives go in a group, `.where((either) => either.where(a).orWhere(b))`.
 */
export function whereTenant<Row extends object, Result>(
  builder: Knex.QueryBuilder<Row, Result>,
  scope: ExecutionScope,
  column = TENANT_COLUMN,
): Knex.QueryBuilder<Row, Result> {
  const reach = tenantReachOf(scope);

  if (reach.kind === 'tenant') {
    return conjunctBuilder(builder.where(column, reach.tenantId));
  }

  return conjunctBuilder(reach.tenants === 'all' ? builder : builder.whereIn(column, [...reach.tenants]));
}
