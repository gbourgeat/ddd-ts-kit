import { InvalidCredentialError, principalResolver, type Authenticator } from '@ddd-ts-kit/auth';
import { JwtAuthenticator } from '@ddd-ts-kit/auth/jwt';
import type { Session } from '@ddd-ts-kit/kernel';
import type { AppConfig } from '../config.js';

/** The scheme routes name in `security`, as the OpenAPI document declares it. */
export const SECURITY_SCHEMES = { bearer: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' } };

/** Verifies the bearer token against the keys the issuer publishes. The session keeps nothing of the token. */
export function createAuthenticator(config: AppConfig): Authenticator {
  return new JwtAuthenticator({ issuer: config.auth.issuer, audience: config.auth.audience, jwksUri: config.auth.jwksUri });
}

/** Reads the bearer credential of a request and answers its session: who, since when, how it was authenticated. */
export function principalOf(authenticator: Authenticator): (raw: unknown) => Promise<Session> {
  return principalResolver(authenticator);
}

/** For tools that compose the application without serving it (contract generation): no credential is accepted. */
export const offlineAuthenticator: Authenticator = {
  authenticate: () => Promise.reject(new InvalidCredentialError('OFFLINE')),
};
