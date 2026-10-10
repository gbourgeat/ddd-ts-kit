import type { Actor, ActorAttribute } from '@ddd-ts-kit/kernel';
import { InvalidCredentialError } from '../errors/invalid-credential-error.js';
import type { Claims } from './claims.js';
import { isServiceAccount } from './is-service-account.js';
import type { KeycloakClaimOptions } from './keycloak-claim-options.js';

const DEFAULT_TENANT_CLAIM = 'tenant_id';
const DEFAULT_GROUPS_CLAIM = 'groups';

/** The actor of an access token issued by Keycloak. The token itself is never kept. */
export function keycloakActorOf(claims: Claims, options: KeycloakClaimOptions): Actor {
  const id = claims['sub'];

  if (typeof id !== 'string' || id === '') {
    throw new InvalidCredentialError('NO_SUBJECT');
  }

  const tenantId = tenantOf(claims[options.tenantClaim ?? DEFAULT_TENANT_CLAIM]);

  return {
    id,
    type: isServiceAccount(claims) ? 'service' : 'user',
    ...(tenantId === undefined ? {} : { tenantId }),
    roles: rolesOf(claims, options.clientId),
    attributes: attributesOf(claims, options.groupsClaim ?? DEFAULT_GROUPS_CLAIM),
  };
}

/**
 * A text claim is the tenant. The `organization` claim lists the organizations of the user, as
 * a list of aliases or as an object keyed by alias: it names a tenant only when there is
 * exactly one, since choosing among several is a decision of the project.
 */
function tenantOf(claim: unknown): string | undefined {
  if (typeof claim === 'string') {
    return claim === '' ? undefined : claim;
  }

  if (typeof claim !== 'object' || claim === null) {
    return undefined;
  }

  const candidates: readonly unknown[] = Array.isArray(claim) ? claim : Object.keys(claim);
  const [only] = candidates;

  return candidates.length === 1 && typeof only === 'string' ? only : undefined;
}

function rolesOf(claims: Claims, clientId: string | undefined): readonly string[] {
  const realmRoles = stringsOf(recordOf(claims['realm_access'])['roles']);
  const access = clientId === undefined ? {} : recordOf(recordOf(claims['resource_access'])[clientId]);

  return [...new Set([...realmRoles, ...stringsOf(access['roles'])])];
}

function stringsOf(claim: unknown): readonly string[] {
  return Array.isArray(claim) ? claim.filter((item): item is string => typeof item === 'string') : [];
}

function recordOf(claim: unknown): Claims {
  return typeof claim === 'object' && claim !== null ? { ...claim } : {};
}

function attributesOf(claims: Claims, groupsClaim: string): Record<string, ActorAttribute> {
  const username = claims['preferred_username'];
  const email = claims['email'];

  return {
    ...(typeof username === 'string' ? { username } : {}),
    ...(typeof email === 'string' ? { email } : {}),
    ...(groupsClaim in claims ? { groups: stringsOf(claims[groupsClaim]) } : {}),
  };
}
