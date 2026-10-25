import type { Authenticator } from '@ddd-ts-kit/auth';
import { passportAuthenticator } from '@ddd-ts-kit/auth/passport';
import { actorOfToken } from '{{alias.platform}}/auth/authentication/actor-of-token{{alias.ext}}';
import { bearerStrategy } from '{{alias.platform}}/auth/authentication/bearer-strategy{{alias.ext}}';
import type { AppConfig } from '{{alias.platform}}/config/app-config{{alias.ext}}';

/**
 * Verifies the bearer token with the strategy of Passport of the platform, against the keys the
 * issuer publishes; the guards of the routes and the permissions of the use cases then decide.
 */
export function createAuthenticator(config: AppConfig): Authenticator {
  return passportAuthenticator(bearerStrategy(config.auth), { actorOf: actorOfToken });
}
