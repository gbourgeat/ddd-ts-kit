import type { Actor, ActorAttribute } from '@ddd-ts-kit/kernel';
import { InvalidCredentialError } from '../errors/invalid-credential-error';
import type { Claims } from './claims';
import { isServiceAccount } from './is-service-account';
import type { KeycloakClaimOptions } from './keycloak-claim-options';
import { profileAttributesOf } from './profile-attributes-of';
import { tenancyOfClaim } from './tenancy-of-claim';

const DEFAULT_TENANT_CLAIM = 'tenant_id';
const DEFAULT_GROUPS_CLAIM = 'groups';

/** The actor of an access token issued by Keycloak. The token itself is never kept. */
export function keycloakActorOf(claims: Claims, options: KeycloakClaimOptions): Actor {
  const id = claims['sub'];

  if (typeof id !== 'string' || id === '') {
    throw new InvalidCredentialError('NO_SUBJECT');
  }

  const { tenantId, tenants } = tenancyOfClaim(claims[options.tenantClaim ?? DEFAULT_TENANT_CLAIM]);

  return {
    id,
    type: isServiceAccount(claims) ? 'service' : 'user',
    ...(tenantId === undefined ? {} : { tenantId }),
    roles: rolesOf(claims, options.clientId),
    attributes: {
      ...attributesOf(claims, options.groupsClaim ?? DEFAULT_GROUPS_CLAIM),
      ...(tenants === undefined ? {} : { tenants }),
    },
  };
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
  return {
    ...profileAttributesOf(claims),
    ...(groupsClaim in claims ? { groups: stringsOf(claims[groupsClaim]) } : {}),
  };
}
