import type { AuthenticationMethod } from '@ddd-ts-kit/kernel';
import type { Claims } from './claims';
import { isServiceAccount } from './is-service-account';

/** A person signs in through the single sign-on of the realm; a client presents its own secret. */
export function keycloakAuthenticationMethod(claims: Claims): AuthenticationMethod {
  return isServiceAccount(claims) ? 'service' : 'sso';
}
