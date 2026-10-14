import type { ExecutionScope } from '@ddd-ts-kit/kernel';

/** `{ workTenantId }` when the scope runs work in one tenant, nothing otherwise: spread into a request. */
export function workTenantOf(scope: ExecutionScope | undefined): { readonly workTenantId?: string } {
  const tenantId = scope?.current()?.tenantId;

  return tenantId === undefined ? {} : { workTenantId: tenantId };
}
