import { InvalidTenantIdError } from './invalid-tenant-id-error.js';
import { isTenantId } from './is-tenant-id.js';

/** The tenant id as it came in, refused (`InvalidTenantIdError`) when it is outside the grammar of `isTenantId`. */
export function assertTenantId(tenantId: string): string {
  if (!isTenantId(tenantId)) {
    throw new InvalidTenantIdError(tenantId);
  }

  return tenantId;
}
