import { InvalidCredentialError, principalResolver, type Authenticator } from '@ddd-ts-kit/auth';
import { keycloakAuthenticator } from '@ddd-ts-kit/auth/jwt';
import type { Session } from '@ddd-ts-kit/kernel';
import type { AppConfig } from '../config.js';

/** The scheme routes name in `security`, as the OpenAPI document declares it. */
export const SECURITY_SCHEMES = { bearer: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' } };

/**
 * Verifies the access tokens of the Keycloak realm against the keys it publishes. The actor takes
 * its roles from the realm roles (and from the client roles of `KEYCLOAK_CLIENT_ID` when set), its
 * tenant from the `tenant_id` claim; the session keeps nothing of the token. The realm needs an
 * audience mapper naming this API: docker/keycloak holds a realm that has one, for local use.
 */
export function createAuthenticator(config: AppConfig): Authenticator {
  const { baseUrl, realm, audience, clientId } = config.keycloak;
  return keycloakAuthenticator({ baseUrl, realm, audience, ...(clientId === undefined ? {} : { clientId }) });
}

/** Reads the bearer credential of a request and answers its session: who, since when, how it was authenticated. */
export function principalOf(authenticator: Authenticator): (raw: unknown) => Promise<Session> {
  return principalResolver(authenticator);
}

/** For tools that compose the application without serving it (contract generation): no credential is accepted. */
export const offlineAuthenticator: Authenticator = {
  authenticate: () => Promise.reject(new InvalidCredentialError('OFFLINE')),
};
