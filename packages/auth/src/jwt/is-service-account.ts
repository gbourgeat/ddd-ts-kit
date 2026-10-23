import type { Claims } from './claims';

/** Keycloak names the user that stands for a client `service-account-<client id>`. */
const SERVICE_ACCOUNT_PREFIX = 'service-account-';

export function isServiceAccount(claims: Claims): boolean {
  const username = claims['preferred_username'];

  return typeof username === 'string' && username.startsWith(SERVICE_ACCOUNT_PREFIX);
}
