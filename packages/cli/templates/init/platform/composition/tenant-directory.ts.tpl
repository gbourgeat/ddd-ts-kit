import { InMemoryTenantDirectory, type TenantDirectory } from '@ddd-ts-kit/kernel';
import type { Persistence } from '{{alias.platform}}/database/persistence{{alias.ext}}';

/**
 * The tenants a job declared `per-tenant` runs for, asked again at each occurrence.
 *
 * The project has no source of tenants yet, so this is the list of `TENANTS`, read once when the
 * process starts: an organisation or a customer created later gets no run of such a job until the
 * process restarts. Where the tenants live in the database, read them here instead (the identity
 * preset writes this file that way: its organisations are the tenants).
 */
export function tenantDirectory(_persistence: Persistence, fixed: readonly string[] = []): TenantDirectory {
  return new InMemoryTenantDirectory(fixed);
}
