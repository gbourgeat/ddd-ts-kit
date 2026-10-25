import { passportJwtSecret } from 'jwks-rsa';
import { ExtractJwt, Strategy } from 'passport-jwt';

/** Who issues the tokens and whom they are for, with where the keys that sign them are. */
export type BearerTokens = {
  readonly issuer: string;
  readonly audience: string;
} & ({ readonly jwksUri: string } | { readonly publicKey: string });

const ALGORITHMS = ['RS256', 'PS256', 'ES256'] as const;

/**
 * The strategy of Passport that verifies a bearer token: its signature, against the key set the
 * issuer publishes (or one public key, as the end-to-end tests sign with), its issuer, its
 * audience, its expiry. It hands the payload on as the user; `actorOfToken` reads it.
 */
export function bearerStrategy(tokens: BearerTokens): Strategy {
  const verified = { jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(), issuer: tokens.issuer, audience: tokens.audience, algorithms: [...ALGORITHMS] };
  const handOn = (payload: unknown, done: (error: unknown, user?: unknown) => void): void => done(null, payload);

  if ('publicKey' in tokens) {
    return new Strategy({ ...verified, secretOrKey: tokens.publicKey }, handOn);
  }

  return new Strategy(
    { ...verified, secretOrKeyProvider: passportJwtSecret({ jwksUri: tokens.jwksUri, cache: true, rateLimit: true }) },
    handOn,
  );
}
