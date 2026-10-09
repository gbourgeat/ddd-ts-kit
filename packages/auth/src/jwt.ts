import { anonymousActor, type Actor } from '@ddd-ts-kit/kernel';
import { createRemoteJWKSet, errors, jwtVerify, type JWTPayload, type JWTVerifyGetKey, type KeyInput } from 'jose';
import type { Authenticator } from './authentication.js';
import { InvalidCredentialError } from './errors.js';

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
 * its claims to an actor. An unsigned token (`alg: none`) is always refused.
 */
export class JwtAuthenticator implements Authenticator {
  readonly #key: KeyInput | JWTVerifyGetKey;

  constructor(private readonly options: JwtAuthenticatorOptions) {
    this.#key = 'jwksUri' in options ? createRemoteJWKSet(new URL(options.jwksUri)) : options.key;
  }

  async authenticate(credential: string | undefined): Promise<Actor> {
    if (credential === undefined) return anonymousActor();
    const claims = await this.#verify(credential);
    return (this.options.toActor ?? ((payload) => this.#actorOf(payload)))(claims);
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
