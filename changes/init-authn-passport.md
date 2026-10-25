**`init --authn passport` verifies the bearer tokens with a strategy of Passport, and the identity preset runs on it.**
The platform gets `bearer-strategy.ts`, a strategy of `passport-jwt` on the key set the issuer
publishes (`jwks-rsa`, `AUTH_JWKS_URI`), its issuer and its audience, and `actor-of-token.ts`,
which reads the payload with `actorOfClaims`; `create-authenticator.ts` puts them behind the
`Authenticator` port with `passportAuthenticator`, new in `@ddd-ts-kit/auth/passport`, so that the
HTTP boundary, the procedures and the end-to-end tests (credentials signed for the strategy)
authenticate through it. `actorOfClaims`, the reading of claims of `JwtAuthenticator`, is now
exported by `@ddd-ts-kit/auth` without `jose`. The identity preset accepts `--authn passport`.
