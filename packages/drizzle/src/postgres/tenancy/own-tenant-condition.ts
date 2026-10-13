import { eq, type SQL } from 'drizzle-orm';
import type { PgColumn } from 'drizzle-orm/pg-core';
import { tenantScopeOf, type ExecutionScope } from '@ddd-ts-kit/kernel';

/** The condition of an update or a delete: the one tenant of the work in progress, whatever an elevation widens. */
export function ownTenantCondition(column: PgColumn, scope: ExecutionScope): SQL {
  return eq(column, tenantScopeOf(scope).tenantId);
}
