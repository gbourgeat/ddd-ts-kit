import type {
  Actor,
  AuthenticationMethod,
  AuthenticationStrength,
  Session,
  SessionExtensionValues,
} from '@ddd-ts-kit/kernel';
import type { Claims } from './claims.js';

export interface SessionClaimOptions<C extends Claims> {
  readonly impersonatorClaim?: string;
  readonly authenticationMethod?: AuthenticationMethod | ((claims: C) => AuthenticationMethod);
  readonly toSessionExtensions?: (claims: C) => SessionExtensionValues;
}

/** RFC 8693: the party acting for the subject is the `sub` of the `act` claim. */
const ACTOR_CLAIM = 'act';
const NEVER_ISSUED = new Date(0);

/**
 * The session a verified token stands for. Registered claims only (RFC 7519, OpenID Connect
 * Core, RFC 8176, RFC 8693): the identity provider decides what they say.
 */
export function sessionOfClaims<C extends Claims>(claims: C, actor: Actor, options: SessionClaimOptions<C>): Session {
  const issuedAt = instantOf(claims['iat']);

  return {
    id: textOf(claims['sid']) ?? textOf(claims['jti']) ?? `${actor.id}@${String(issuedAt?.getTime() ?? 0)}`,
    actor,
    issuedAt: issuedAt ?? NEVER_ISSUED,
    authenticationMethod: methodOf(claims, options.authenticationMethod),
    ...optional('expiresAt', instantOf(claims['exp'])),
    ...optional('authenticationStrength', strengthOf(claims)),
    ...optional('impersonatedBy', impersonatorOf(claims[options.impersonatorClaim ?? ACTOR_CLAIM])),
    ...optional('locale', textOf(claims['locale'])),
    ...optional('timeZone', textOf(claims['zoneinfo'])),
    extensions: options.toSessionExtensions?.(claims) ?? {},
  };
}

/** A NumericDate (RFC 7519): seconds since the epoch. */
function instantOf(claim: unknown): Date | undefined {
  return typeof claim === 'number' && Number.isFinite(claim) ? new Date(claim * 1000) : undefined;
}

function textOf(claim: unknown): string | undefined {
  return typeof claim === 'string' && claim !== '' ? claim : undefined;
}

function methodOf<C extends Claims>(
  claims: C,
  configured: SessionClaimOptions<C>['authenticationMethod'],
): AuthenticationMethod {
  if (typeof configured === 'function') {
    return configured(claims);
  }

  return configured ?? (methodReferencesOf(claims)?.includes('pwd') === true ? 'password' : 'token');
}

function methodReferencesOf(claims: Claims): readonly string[] | undefined {
  const references = claims['amr'];

  if (!Array.isArray(references)) {
    return undefined;
  }

  return references.filter((reference): reference is string => typeof reference === 'string');
}

function optional<Key extends string, Value>(key: Key, value: Value | undefined): Partial<Record<Key, Value>> {
  if (value === undefined) {
    return {};
  }

  const present: Partial<Record<Key, Value>> = {};

  present[key] = value;

  return present;
}

/** `amr` (RFC 8176) says how; `acr` says how sure, in the vocabulary of the provider. */
function strengthOf(claims: Claims): AuthenticationStrength | undefined {
  const references = methodReferencesOf(claims);
  const assuranceLevel = textOf(claims['acr']);

  if (references === undefined && assuranceLevel === undefined) {
    return undefined;
  }

  return {
    ...(references === undefined ? {} : { mfa: references.includes('mfa') }),
    ...(assuranceLevel === undefined ? {} : { assuranceLevel }),
  };
}

/** The claim is the id itself, or an object naming it under `sub` (RFC 8693) or `id`. */
function impersonatorOf(claim: unknown): string | undefined {
  if (typeof claim !== 'object' || claim === null) {
    return textOf(claim);
  }

  const named: Claims = { ...claim };

  return textOf(named['sub']) ?? textOf(named['id']);
}
