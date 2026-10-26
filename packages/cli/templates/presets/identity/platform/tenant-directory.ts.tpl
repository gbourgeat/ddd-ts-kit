import type { TenantDirectory } from '@ddd-ts-kit/kernel';
import type { Persistence } from '{{alias.platform}}/database/persistence{{alias.ext}}';
import { {{preset.adapter.pascal}}OrganisationTenantDirectory } from '{{alias.context}}/infrastructure/persistence/{{preset.adapter.kebab}}-organisation-tenant-directory.reader{{alias.ext}}';

/**
 * The tenants a job declared `per-tenant` runs for, asked again at each occurrence: the
 * organisations of the {{context.kebab}} context, read from the database. An organisation opened
 * after the process started gets its run at the next occurrence, with no restart. `TENANTS` is
 * not read here: it is the list of a project with no source of tenants.
 */
export function tenantDirectory(persistence: Persistence, _fixed: readonly string[] = []): TenantDirectory {
  return new {{preset.adapter.pascal}}OrganisationTenantDirectory(persistence.database);
}
