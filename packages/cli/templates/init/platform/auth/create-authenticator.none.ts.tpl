import type { Authenticator } from '@ddd-ts-kit/auth';
import type { AppConfig } from '../config/app-config.js';
import { DevelopmentHeaderAuthenticator } from './development-header-authenticator.js';

// TODO(platform): replace the development authenticator by a real adapter of Authenticator (a JWT verifier, your identity provider) before the first deployment.
export function createAuthenticator(config: AppConfig): Authenticator {
  return new DevelopmentHeaderAuthenticator(config.environment);
}
