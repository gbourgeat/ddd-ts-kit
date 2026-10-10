/** What the configuration of the application needs to be valid in a test; the tests bring their own verifier. */
export const authEnvironment = {
  KEYCLOAK_URL: 'http://keycloak.e2e.test',
  KEYCLOAK_REALM: 'e2e',
  KEYCLOAK_AUDIENCE: 'e2e-api',
};
