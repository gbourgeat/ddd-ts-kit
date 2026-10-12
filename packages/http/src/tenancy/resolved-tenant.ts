import { isAnonymous, isTenantMember, type Actor } from '@ddd-ts-kit/kernel';
import { ForbiddenError } from '../error/forbidden-error.js';
import { isRecord } from '../support/is-record.js';
import type { RawHeaders } from '../route/raw-headers.js';
import type { TenantResolver } from './tenant-resolver.js';

interface TenantResolution {
  readonly resolver: TenantResolver | undefined;
  readonly headers: Readonly<RawHeaders>;
  readonly params: unknown;
  readonly actor: Actor;
}

/**
 * The tenant a request names, refused (403) when an authenticated caller does not belong to it:
 * a header or a subdomain chosen by the client never opens another tenant's data. An anonymous
 * caller keeps the tenant it addressed, for the public routes of a tenant (its sign-in page, its
 * booking page); what it may do there is decided by the use cases, as for any anonymous caller.
 */
export function resolvedTenant({ resolver, headers, params, actor }: TenantResolution): string | undefined {
  const tenantId = resolver?.({ headers, params: isRecord(params) ? params : {}, actor });

  if (tenantId === undefined || isAnonymous(actor) || isTenantMember(actor, tenantId)) {
    return tenantId;
  }

  throw new ForbiddenError('The tenant of the request is not one the caller belongs to');
}
