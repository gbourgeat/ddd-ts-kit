import type { Authenticator } from '@ddd-ts-kit/auth';
import type { AppConfig } from '{{alias.platform}}/config/app-config{{alias.ext}}';
import { DevelopmentHeaderAuthenticator } from '{{alias.platform}}/auth/authentication/development-header-authenticator{{alias.ext}}';

// TODO(platform): replace the development authenticator by a real adapter of Authenticator (a JWT verifier, your identity provider) before the first deployment.
export function createAuthenticator(config: AppConfig): Authenticator {
  return new DevelopmentHeaderAuthenticator(config.environment);
}
