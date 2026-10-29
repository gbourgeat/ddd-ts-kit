/**
 * The algorithms a token may be signed with unless the verifier is told otherwise: the asymmetric
 * families RS256, PS256, ES256 and EdDSA. A shared secret (HS256) is never among them: it is said.
 * `JwtAuthenticator` allows them; the strategy of Passport `init --authn passport` writes allows
 * the same but EdDSA, which `jsonwebtoken` (under `passport-jwt`) cannot verify.
 */
export const DEFAULT_JWT_ALGORITHMS: readonly string[] = Object.freeze(['RS256', 'PS256', 'ES256', 'EdDSA']);
