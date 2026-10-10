import type { Authenticator } from '@ddd-ts-kit/auth';
import { keycloakAuthenticator } from '@ddd-ts-kit/auth/jwt';
import type { AppConfig } from '@/platform/config/app-config.js';

/**
 * Verifies the access tokens of the Keycloak realm against the keys it publishes. The actor takes
 * its roles from the realm roles (and from the client roles of `KEYCLOAK_CLIENT_ID` when set), its
 * tenant from the `tenant_id` claim; the session keeps nothing of the token. The realm needs an
 * audience mapper naming this API: docker/keycloak holds a realm that has one, for local use.
 * Support staff act through a token of the user they impersonate: the session note `IMPERSONATOR_ID`
 * of Keycloak, mapped to the claim below, becomes `session.impersonatedBy`.
 */
export const IMPERSONATOR_CLAIM = 'impersonator_id';

export function createAuthenticator(config: AppConfig): Authenticator {
  const { baseUrl, realm, audience, clientId } = config.keycloak;

  return keycloakAuthenticator({
    baseUrl,
    realm,
    audience,
    impersonatorClaim: IMPERSONATOR_CLAIM,
    ...(clientId === undefined ? {} : { clientId }),
  });
}
