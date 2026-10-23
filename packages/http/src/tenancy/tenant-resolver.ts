import type { TenantRequest } from './tenant-request';

/**
 * Names the tenant of a request, or `undefined` when the request names none: the subdomain, a
 * header, a path segment or a claim of the credential. What it answers becomes the `tenantId` of
 * the execution context, once the pipeline has checked that the caller belongs to it.
 */
export interface TenantResolver {
  (request: TenantRequest): string | undefined;
  /**
   * The request headers it reads the tenant from, besides `Host`, which every cache keys on
   * already: a cached answer varies on them (`Vary`), so that a cache never hands the answer of
   * one tenant to another. `tenantFromHeader` names its header; a resolver of the project names
   * the headers it reads.
   */
  readonly headers?: readonly string[];
}
