import type { ExecutionScope } from '@ddd-ts-kit/kernel';

/**
 * For a read model of tenant data: every row is written with the tenant of the work in
 * progress, in `field`, and every read and write is confined to it, an elevation widening the
 * reads only. Keys stay unique across tenants (the conflict of an insert is on the key alone):
 * a key that two tenants could share (a day, a slug) is a generated id, or carries the tenant
 * (`acme:2026-03-01`). Absent: one read model for every tenant.
 */
export interface PrismaReadModelTenant {
  readonly scope: ExecutionScope;
  /** The field of the model that holds the tenant, mapped to its column by `columns` or to `tenant_id`. Default `tenantId`. */
  readonly field?: string;
}
