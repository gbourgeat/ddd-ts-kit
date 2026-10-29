import {
  anonymousSession,
  type Actor,
  type AuthenticationMethod,
  type Session,
  type SessionExtensionValues,
} from '@ddd-ts-kit/kernel';
import { createRemoteJWKSet, errors, jwtVerify, type JWTPayload, type JWTVerifyGetKey, type KeyInput } from 'jose';
import type { SessionAuthenticator } from '../authentication/session-authenticator';
import { InvalidCredentialError } from '../errors/invalid-credential-error';
import { actorOfClaims } from './actor-of-claims';
import { DEFAULT_JWT_ALGORITHMS } from './default-jwt-algorithms';
import { sessionOfClaims } from './session-of-claims';

interface CommonOptions {
  readonly issuer: string;
  readonly audience: string | readonly string[];
  /** Default `DEFAULT_JWT_ALGORITHMS`: RS256, PS256, ES256 and EdDSA. A shared secret needs HS256 said. */
  readonly algorithms?: readonly string[];
  /** Seconds of clock difference tolerated on `exp` and `nbf`. Default 0. */
  readonly clockTolerance?: number;
  /**
   * Whether a token must carry `exp`. Default `true`: a token without it is refused (`NO_EXPIRY`).
   * `false` is a conscious choice, for an issuer whose tokens never expire: a stolen one then
   * works until its key is revoked.
   */
  readonly requireExpiry?: boolean;
  /** The claim holding the tenant of the default mapping. Default `tenant_id`; a list names the tenants of an actor of several. */
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

type SessionReader = (token: string) => Promise<Session>;

/**
 * Verifies a signed JWT (signature, issuer, audience, expiry, algorithm allow-list) and maps its
 * claims to an actor and to its session. A token without `exp` is refused unless `requireExpiry`
 * is `false`; an unsigned token (`alg: none`) is always refused.
 *
 * The session reads registered claims: id from `sid`, else `jti`, else the subject and issue
 * instant; `issuedAt` and `expiresAt` from `iat` and `exp`; the method and strength from `amr`
 * and `acr`; `impersonatedBy` from `act`; `locale` and `timeZone` from `locale` and `zoneinfo`.
 */
export class JwtAuthenticator implements SessionAuthenticator {
  /*
   * The verification key, which may be a shared secret, is held by this function and by
   * nothing else: an authenticator that is logged, spread or serialized shows no key.
   */
  private readonly sessionOfToken: SessionReader;

  constructor(options: JwtAuthenticatorOptions) {
    this.sessionOfToken = sessionReaderOf(options);
  }

  async authenticate(credential: string | undefined): Promise<Actor> {
    return (await this.authenticateSession(credential)).actor;
  }

  async authenticateSession(credential: string | undefined): Promise<Session> {
    return credential === undefined ? anonymousSession() : this.sessionOfToken(credential);
  }
}

const DEFAULT_TENANT_CLAIM = 'tenant_id';

function sessionReaderOf(options: JwtAuthenticatorOptions): SessionReader {
  const key = 'jwksUri' in options ? createRemoteJWKSet(new URL(options.jwksUri)) : options.key;
  const tenantClaim = options.tenantClaim ?? DEFAULT_TENANT_CLAIM;
  const toActor = options.toActor ?? ((claims: JWTPayload) => actorOfClaims(claims, tenantClaim));

  return async (token) => {
    const claims = await verifiedClaims(token, key, options);

    return sessionOfClaims(claims, toActor(claims), options);
  };
}

async function verifiedClaims(
  token: string,
  key: KeyInput | JWTVerifyGetKey,
  options: JwtAuthenticatorOptions,
): Promise<JWTPayload> {
  const { issuer, audience, algorithms = DEFAULT_JWT_ALGORITHMS, clockTolerance = 0, requireExpiry = true } = options;

  try {
    const { payload } = await jwtVerify(token, key, {
      issuer,
      audience: [...[audience].flat()],
      algorithms: [...algorithms],
      clockTolerance,
      requiredClaims: requireExpiry ? ['exp'] : [],
    });

    return payload;
  } catch (error) {
    throw refusalOf(error);
  }
}

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
 * A refused token is an `InvalidCredentialError`; anything else (the key set cannot be fetched)
 * is an infrastructure fault and stays what it is, to be answered as a 5xx.
 */
function refusalOf(error: unknown): unknown {
  if (!(error instanceof errors.JOSEError)) {
    return error;
  }

  if (error instanceof errors.JWTClaimValidationFailed && error.claim === 'exp' && error.reason === 'missing') {
    return new InvalidCredentialError('NO_EXPIRY');
  }

  const reason = REASONS[error.code];

  return reason === undefined ? error : new InvalidCredentialError(reason);
}
