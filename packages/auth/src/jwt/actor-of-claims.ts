import type { Actor } from '@ddd-ts-kit/kernel';
import { InvalidCredentialError } from '../errors/invalid-credential-error';
import type { Claims } from './claims';
import { profileAttributesOf } from './profile-attributes-of';
import { tenancyOfClaim } from './tenancy-of-claim';

const DEFAULT_TENANT_CLAIM = 'tenant_id';

/**
 * The actor the claims of a verified token stand for, as `JwtAuthenticator` reads them by default:
 * `id` from `sub` (required), `type: 'user'`, the tenant from `tenantClaim` (`tenant_id`), the
 * roles from `realm_access.roles`, else from a `roles` claim, never from `scope`, and the profile
 * of OpenID Connect (`username`, `email`, `emailVerified`). Pure: any verifier of tokens (a
 * strategy of Passport) maps its payload with it.
 */
export function actorOfClaims(claims: Claims, tenantClaim = DEFAULT_TENANT_CLAIM): Actor {
  const subject = claims['sub'];

  if (typeof subject !== 'string' || subject === '') {
    throw new InvalidCredentialError('NO_SUBJECT');
  }

  const { tenantId, tenants } = tenancyOfClaim(claims[tenantClaim]);

  return {
    id: subject,
    type: 'user',
    ...(tenantId === undefined ? {} : { tenantId }),
    roles: rolesOf(claims),
    attributes: { ...profileAttributesOf(claims), ...(tenants === undefined ? {} : { tenants }) },
  };
}

/**
 * The realm roles (`realm_access.roles`) when present, else a `roles` claim, never merged. The
 * OAuth scopes are never roles: a scope a client asked for must not pass for a role, the session
 * holds them as `scopes`. A provider whose tokens carry only scopes maps its roles with `toActor`.
 */
function rolesOf(claims: Claims): readonly string[] {
  const realmAccess = claims['realm_access'];

  const realmRoles =
    typeof realmAccess === 'object' && realmAccess !== null && 'roles' in realmAccess ? realmAccess.roles : undefined;

  return stringsOf(realmRoles) ?? stringsOf(claims['roles']) ?? [];
}

function stringsOf(claim: unknown): readonly string[] | undefined {
  if (typeof claim === 'string') {
    return claim.split(' ').filter((item) => item !== '');
  }

  if (!Array.isArray(claim)) {
    return undefined;
  }

  return claim.filter((item): item is string => typeof item === 'string');
}
