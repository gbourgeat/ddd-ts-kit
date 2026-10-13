import type { TenantRequest } from './tenant-request.js';

/**
 * Names the tenant of a request, or `undefined` when the request names none: the subdomain, a
 * header, a path segment or a claim of the credential. What it answers becomes the `tenantId` of
 * the execution context, once the pipeline has checked that the caller belongs to it.
 */
export type TenantResolver = (request: TenantRequest) => string | undefined;
