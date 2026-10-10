import type { Authenticator } from '@ddd-ts-kit/auth';
import { JwtAuthenticator } from '@ddd-ts-kit/auth/jwt';
import type { AppConfig } from '../config/app-config.js';

/** Verifies the bearer token against the keys the issuer publishes. The session keeps nothing of the token. */
export function createAuthenticator(config: AppConfig): Authenticator {
  return new JwtAuthenticator({
    issuer: config.auth.issuer,
    audience: config.auth.audience,
    jwksUri: config.auth.jwksUri,
  });
}
