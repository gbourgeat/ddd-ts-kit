import { passportJwtSecret } from 'jwks-rsa';
import { ExtractJwt, Strategy } from 'passport-jwt';

/** Who issues the tokens and whom they are for, with where the keys that sign them are. */
export type BearerTokens = {
  readonly issuer: string;
  readonly audience: string;
  /**
   * Whether a token must carry `exp`, as `requireExpiry` of `JwtAuthenticator`. Default `true`: a
   * token without it is refused. `false` is a conscious choice, for an issuer whose tokens never
   * expire: a stolen one then works until its key is revoked.
   */
  readonly requireExpiry?: boolean;
} & ({ readonly jwksUri: string } | { readonly publicKey: string });

/**
 * `DEFAULT_JWT_ALGORITHMS` of `@ddd-ts-kit/auth`, the algorithms `JwtAuthenticator` allows, but
 * EdDSA, which `jsonwebtoken` (under `passport-jwt`) cannot verify: an issuer that signs with
 * EdDSA needs `--authn jwt`.
 */
const ALGORITHMS = ['RS256', 'PS256', 'ES256'] as const;

/**
 * The strategy of Passport that verifies a bearer token: its signature, against the key set the
 * issuer publishes (or one public key, as the end-to-end tests sign with), its issuer, its
 * audience, its expiry, which it must carry unless `requireExpiry` is `false`. It hands the
 * payload on as the user; `actorOfToken` reads it.
 */
export function bearerStrategy(tokens: BearerTokens): Strategy {
  const verified = {
    jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
    issuer: tokens.issuer,
    audience: tokens.audience,
    algorithms: [...ALGORITHMS],
  };

  const requireExpiry = tokens.requireExpiry ?? true;

  const handOn = (payload: unknown, done: (error: unknown, user?: unknown, info?: unknown) => void): void => {
    if (requireExpiry && !carriesExpiry(payload)) {
      done(null, false, { message: 'NO_EXPIRY' });
    } else {
      done(null, payload);
    }
  };

  if ('publicKey' in tokens) {
    return new Strategy({ ...verified, secretOrKey: tokens.publicKey }, handOn);
  }

  return new Strategy(
    { ...verified, secretOrKeyProvider: passportJwtSecret({ jwksUri: tokens.jwksUri, cache: true, rateLimit: true }) },
    handOn,
  );
}

/** `passport-jwt` checks `exp` when the token carries it, and lets a token without it through. */
function carriesExpiry(payload: unknown): boolean {
  return typeof payload === 'object' && payload !== null && 'exp' in payload;
}
