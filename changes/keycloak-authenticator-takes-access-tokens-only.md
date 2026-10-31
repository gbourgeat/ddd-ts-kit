**`keycloakAuthenticator` takes the access tokens of the realm and no other: a token whose `typ` claim is not `Bearer` is refused with `NOT_AN_ACCESS_TOKEN`.** An ID token is refused whatever its audience. `JwtAuthenticator` on another issuer does not change. See [Identity](docs/tools/identity.md).

To move: a spec that signs its own tokens for a Keycloak authenticator adds `typ: 'Bearer'` to the claims, as `test/e2e/support/create-credentials.ts` of a generated project now does.
