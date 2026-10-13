import { sql, type SQL } from 'drizzle-orm';
import { tenantReachOf, type ExecutionScope } from '@ddd-ts-kit/kernel';

/** The condition of a read on a tenant column given as SQL: the tenant of the work, or the tenants of an elevation. */
export function reachCondition(column: SQL, scope: ExecutionScope): SQL {
  const reach = tenantReachOf(scope);

  if (reach.kind === 'tenant') {
    return sql`${column} = ${reach.tenantId}`;
  }

  if (reach.tenants === 'all') {
    return sql`true`;
  }

  return sql`${column} = any(${sql.param([...reach.tenants])})`;
}
