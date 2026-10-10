/** What the configuration of the application needs to be valid in a test; no key is ever fetched. */
export const authEnvironment = { AUTH_ISSUER: 'https://issuer.e2e.test', AUTH_AUDIENCE: 'e2e', AUTH_JWKS_URI: 'https://issuer.e2e.test/keys' };
