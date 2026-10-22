import { isAnonymous, isTenantId, isTenantMember, type Actor } from '@ddd-ts-kit/kernel';
import { guardRefusals } from '../controller/guard-refusals';
import { ForbiddenError } from '../error/forbidden-error';
import { isRecord } from '../support/is-record';
import type { RawHeaders } from '../route/raw-headers';
import type { TenantResolver } from './tenant-resolver';
import { UnknownTenantError } from './unknown-tenant-error';

interface TenantResolution {
  readonly resolver: TenantResolver | undefined;
  readonly headers: Readonly<RawHeaders>;
  readonly params: unknown;
  readonly actor: Actor;
}

/**
 * The tenant a request names, refused (403) when an authenticated caller does not belong to it:
 * a header or a subdomain chosen by the client never opens another tenant's data. A tenant id
 * outside the grammar of `isTenantId` (`*`, a list, a `:`) names no tenant that can exist, and
 * is answered 404 before anything reads it, whoever calls. An anonymous caller keeps the tenant
 * it addressed, for the public routes of a tenant (its sign-in page, its booking page); what it
 * may do there is decided by the use cases, as for any anonymous caller. An authenticated caller
 * is held to its tenants on every route, public ones included: to open the public page of
 * another tenant, it calls without its credential.
 */
export function resolvedTenant({ resolver, headers, params, actor }: TenantResolution): string | undefined {
  const tenantId = resolver?.({ headers, params: isRecord(params) ? params : {}, actor });

  if (tenantId !== undefined && !isTenantId(tenantId)) {
    throw new UnknownTenantError('The request names no tenant that can exist');
  }

  if (tenantId === undefined || isAnonymous(actor) || isTenantMember(actor, tenantId)) {
    return tenantId;
  }

  const refused = new ForbiddenError('The tenant of the request is not one the caller belongs to');

  // Refused at the edge like a guard refuses, and reported as one (`onGuardRefusal`).
  guardRefusals.mark(refused);

  throw refused;
}
