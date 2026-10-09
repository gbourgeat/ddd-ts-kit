import {
  anonymousSession,
  type Actor,
  type AuthenticationMethod,
  type Session,
  type SessionExtensionValues,
} from '@ddd-ts-kit/kernel';
import { createRemoteJWKSet, errors, jwtVerify, type JWTPayload, type JWTVerifyGetKey, type KeyInput } from 'jose';
import type { SessionAuthenticator } from './authentication.js';
import { InvalidCredentialError } from './errors.js';
import {
  keycloakActorOf,
  keycloakAuthenticationMethod,
  type KeycloakClaimOptions,
} from './jwt/keycloak-claims.js';
import { sessionOfClaims } from './jwt/session-claims.js';

interface CommonOptions {
  readonly issuer: string;
  readonly audience: string | readonly string[];
  /** Default: the asymmetric families RS256, PS256, ES256 and EdDSA. A shared secret needs HS256 said. */
  readonly algorithms?: readonly string[];
  /** Seconds of clock difference tolerated on `exp` and `nbf`. Default 0. */
  readonly clockTolerance?: number;
  /** The claim holding the tenant of the default mapping. Default `tenant_id`. */
  readonly tenantClaim?: string;
  /** Replaces the default mapping. Must not keep the token: an actor is plain, loggable data. */
  readonly toActor?: (claims: JWTPayload) => Actor;
  /**
   * The claim naming who acts as the subject: the id itself, or an object holding it under
   * `sub` or `id`. Default `act`, the actor claim of RFC 8693.
   */
  readonly impersonatorClaim?: string;
  /** Default: `password` when `amr` lists `pwd`, `token` otherwise. */
  readonly authenticationMethod?: AuthenticationMethod | ((claims: JWTPayload) => AuthenticationMethod);
  /** The fields of the project under `session.extensions`. Must not keep the token either. */
  readonly toSessionExtensions?: (claims: JWTPayload) => SessionExtensionValues;
}

export type JwtAuthenticatorOptions = CommonOptions &
  (
    | { /** Where the issuer publishes its keys; fetched and cached. */ readonly jwksUri: string }
    | { /** A public key or a shared secret. */ readonly key: KeyInput }
  );

const DEFAULT_ALGORITHMS = ['RS256', 'PS256', 'ES256', 'EdDSA'];
const DEFAULT_TENANT_CLAIM = 'tenant_id';

/** Why a token was refused, by error code of the verification library. */
const REASONS: Readonly<Record<string, string>> = {
  ERR_JWT_EXPIRED: 'TOKEN_EXPIRED',
  ERR_JWT_CLAIM_VALIDATION_FAILED: 'CLAIM_MISMATCH',
  ERR_JWS_SIGNATURE_VERIFICATION_FAILED: 'BAD_SIGNATURE',
  ERR_JOSE_ALG_NOT_ALLOWED: 'ALGORITHM_NOT_ALLOWED',
  ERR_JOSE_NOT_SUPPORTED: 'UNSUPPORTED_TOKEN',
  ERR_JWKS_NO_MATCHING_KEY: 'UNKNOWN_KEY',
  ERR_JWS_INVALID: 'MALFORMED_TOKEN',
  ERR_JWT_INVALID: 'MALFORMED_TOKEN',
};

/**
 * Verifies a signed JWT (signature, issuer, audience, expiry, algorithm allow-list) and maps
 * its claims to an actor and to its session. An unsigned token (`alg: none`) is always refused.
 *
 * The session reads registered claims: id from `sid`, else `jti`, else the subject and issue
 * instant; `issuedAt` and `expiresAt` from `iat` and `exp`; the method and strength from `amr`
 * and `acr`; `impersonatedBy` from `act`; `locale` and `timeZone` from `locale` and `zoneinfo`.
 */
export class JwtAuthenticator implements SessionAuthenticator {
  readonly #key: KeyInput | JWTVerifyGetKey;

  constructor(private readonly options: JwtAuthenticatorOptions) {
    this.#key = 'jwksUri' in options ? createRemoteJWKSet(new URL(options.jwksUri)) : options.key;
  }

  async authenticate(credential: string | undefined): Promise<Actor> {
    return (await this.authenticateSession(credential)).actor;
  }

  async authenticateSession(credential: string | undefined): Promise<Session> {
    if (credential === undefined) return anonymousSession();
    const claims = await this.#verify(credential);
    const actor = (this.options.toActor ?? ((payload) => this.#actorOf(payload)))(claims);
    return sessionOfClaims(claims, actor, this.options);
  }

  async #verify(token: string): Promise<JWTPayload> {
    const { issuer, audience, algorithms = DEFAULT_ALGORITHMS, clockTolerance = 0 } = this.options;
    try {
      const { payload } = await jwtVerify(token, this.#key, {
        issuer,
        audience: [...[audience].flat()],
        algorithms: [...algorithms],
        clockTolerance,
      });
      return payload;
    } catch (error) {
      throw refusalOf(error);
    }
  }

  #actorOf(claims: JWTPayload): Actor {
    if (claims.sub === undefined || claims.sub === '') throw new InvalidCredentialError('NO_SUBJECT');
    const tenantId = claims[this.options.tenantClaim ?? DEFAULT_TENANT_CLAIM];
    return {
      id: claims.sub,
      type: 'user',
      ...(typeof tenantId === 'string' ? { tenantId } : {}),
      roles: rolesOf(claims),
      attributes: {},
    };
  }
}

export interface KeycloakAuthenticatorOptions extends KeycloakClaimOptions {
  /** Where Keycloak is served, without the realm: `https://id.example.com`. */
  readonly baseUrl: string;
  readonly realm: string;
  /** What the `aud` claim must name: this API, as the audience mapper of the realm writes it. */
  readonly audience: string | readonly string[];
  readonly algorithms?: readonly string[];
  readonly clockTolerance?: number;
  /** Default `act`. See the README for the session note of an administrator impersonating a user. */
  readonly impersonatorClaim?: string;
  readonly toSessionExtensions?: (claims: JWTPayload) => SessionExtensionValues;
}

/**
 * A `JwtAuthenticator` for the access tokens of a Keycloak realm: issuer and key set derived
 * from the realm, realm roles and the roles of `clientId` as `roles`, `preferred_username`,
 * `email` and `groups` as attributes, `sid` as session id.
 */
export function keycloakAuthenticator(options: KeycloakAuthenticatorOptions): JwtAuthenticator {
  const { baseUrl, realm, audience, algorithms, clockTolerance, impersonatorClaim, toSessionExtensions } = options;
  const issuer = `${baseUrl.replace(/\/+$/, '')}/realms/${encodeURIComponent(realm)}`;
  return new JwtAuthenticator({
    issuer,
    audience,
    jwksUri: `${issuer}/protocol/openid-connect/certs`,
    toActor: (claims) => keycloakActorOf(claims, options),
    authenticationMethod: keycloakAuthenticationMethod,
    ...(algorithms === undefined ? {} : { algorithms }),
    ...(clockTolerance === undefined ? {} : { clockTolerance }),
    ...(impersonatorClaim === undefined ? {} : { impersonatorClaim }),
    ...(toSessionExtensions === undefined ? {} : { toSessionExtensions }),
  });
}

/**
 * A refused token is an `InvalidCredentialError`; anything else (the key set cannot be fetched)
 * is an infrastructure fault and stays what it is, to be answered as a 5xx.
 */
function refusalOf(error: unknown): unknown {
  if (!(error instanceof errors.JOSEError)) return error;
  const reason = REASONS[error.code];
  return reason === undefined ? error : new InvalidCredentialError(reason);
}

/**
 * The first claim present wins, in the order realm roles (`realm_access.roles`), a `roles`
 * claim, OAuth scopes. They are never merged: a scope a client asked for must not pass for a role.
 */
function rolesOf(claims: JWTPayload): readonly string[] {
  const realmAccess = claims['realm_access'];
  const realmRoles = typeof realmAccess === 'object' && realmAccess !== null && 'roles' in realmAccess ? realmAccess.roles : undefined;
  const candidates = [stringsOf(realmRoles), stringsOf(claims['roles']), stringsOf(claims['scope'])];
  return candidates.find((roles) => roles !== undefined) ?? [];
}

function stringsOf(claim: unknown): readonly string[] | undefined {
  if (typeof claim === 'string') return claim.split(' ').filter((item) => item !== '');
  if (!Array.isArray(claim)) return undefined;
  return claim.filter((item): item is string => typeof item === 'string');
}
