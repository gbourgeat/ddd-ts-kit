import type { Actor, ActorAttribute, AuthenticationMethod } from '@ddd-ts-kit/kernel';
import { InvalidCredentialError } from '../errors.js';
import type { Claims } from './session-claims.js';

export interface KeycloakClaimOptions {
  /** The client whose roles (`resource_access.<clientId>.roles`) join the realm roles. */
  readonly clientId?: string;
  /** The claim holding the tenant. Default `tenant_id`; `organization` reads the organization of the user. */
  readonly tenantClaim?: string;
  /** The claim written by the group membership mapper. Default `groups`. */
  readonly groupsClaim?: string;
}

const DEFAULT_TENANT_CLAIM = 'tenant_id';
const DEFAULT_GROUPS_CLAIM = 'groups';
/** Keycloak names the user that stands for a client `service-account-<client id>`. */
const SERVICE_ACCOUNT_PREFIX = 'service-account-';

/** The actor of an access token issued by Keycloak. The token itself is never kept. */
export function keycloakActorOf(claims: Claims, options: KeycloakClaimOptions): Actor {
  const id = claims['sub'];
  if (typeof id !== 'string' || id === '') throw new InvalidCredentialError('NO_SUBJECT');
  const tenantId = tenantOf(claims[options.tenantClaim ?? DEFAULT_TENANT_CLAIM]);
  return {
    id,
    type: isServiceAccount(claims) ? 'service' : 'user',
    ...(tenantId === undefined ? {} : { tenantId }),
    roles: rolesOf(claims, options.clientId),
    attributes: attributesOf(claims, options.groupsClaim ?? DEFAULT_GROUPS_CLAIM),
  };
}

/** A person signs in through the single sign-on of the realm; a client presents its own secret. */
export function keycloakAuthenticationMethod(claims: Claims): AuthenticationMethod {
  return isServiceAccount(claims) ? 'service' : 'sso';
}

function isServiceAccount(claims: Claims): boolean {
  const username = claims['preferred_username'];
  return typeof username === 'string' && username.startsWith(SERVICE_ACCOUNT_PREFIX);
}

/**
 * A text claim is the tenant. The `organization` claim lists the organizations of the user, as
 * a list of aliases or as an object keyed by alias: it names a tenant only when there is
 * exactly one, since choosing among several is a decision of the project.
 */
function tenantOf(claim: unknown): string | undefined {
  if (typeof claim === 'string') return claim === '' ? undefined : claim;
  if (typeof claim !== 'object' || claim === null) return undefined;
  const candidates: readonly unknown[] = Array.isArray(claim) ? claim : Object.keys(claim);
  const [only] = candidates;
  return candidates.length === 1 && typeof only === 'string' ? only : undefined;
}

function rolesOf(claims: Claims, clientId: string | undefined): readonly string[] {
  const realmRoles = stringsOf(recordOf(claims['realm_access'])['roles']);
  const access = clientId === undefined ? {} : recordOf(recordOf(claims['resource_access'])[clientId]);
  return [...new Set([...realmRoles, ...stringsOf(access['roles'])])];
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

function recordOf(claim: unknown): Claims {
  return typeof claim === 'object' && claim !== null ? { ...claim } : {};
}

function stringsOf(claim: unknown): readonly string[] {
  return Array.isArray(claim) ? claim.filter((item): item is string => typeof item === 'string') : [];
}
