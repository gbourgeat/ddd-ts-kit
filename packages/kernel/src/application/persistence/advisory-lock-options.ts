import type { ExecutionScope } from '../ports/execution-scope';

export interface AdvisoryLockOptions {
  /**
   * For a key of tenant data: the lock is taken on `tenantKey(tenant, key)`, so two tenants never
   * wait for each other, and work that names no tenant is refused (`NoCurrentTenantError`).
   * Absent: one key for every tenant.
   */
  readonly tenant?: ExecutionScope;
}
