import { InvalidCredentialError, type Authenticator } from '@ddd-ts-kit/auth';
import { anonymousActor, type Actor } from '@ddd-ts-kit/kernel';
import type { AppConfig } from '../config.js';

export const DEVELOPMENT_ACTOR_HEADER = 'x-development-actor';

/** The scheme routes name in `security`, as the OpenAPI document declares it. */
export const SECURITY_SCHEMES = { developmentActor: { type: 'apiKey', in: 'header', name: DEVELOPMENT_ACTOR_HEADER } };

/**
 * Development only: trusts a header instead of verifying a credential. The header reads
 * `<id>`, `<id>;roles=<a>,<b>` or `<id>;roles=<a>;tenant=<t>`. It refuses to exist in production.
 */
export class DevelopmentHeaderAuthenticator implements Authenticator {
  constructor(environment: string) {
    if (environment === 'production') {
      throw new Error('DevelopmentHeaderAuthenticator must never run in production: bind a real adapter of Authenticator');
    }
  }

  async authenticate(credential: string | undefined): Promise<Actor> {
    if (credential === undefined) return anonymousActor();
    const [id = '', ...settings] = credential.split(';').map((part) => part.trim());
    if (id === '') throw new InvalidCredentialError('MALFORMED_DEVELOPMENT_ACTOR');
    const tenantId = valueOf(settings, 'tenant');
    const roles = (valueOf(settings, 'roles') ?? '').split(',').filter((role) => role !== '');
    return { id, type: 'user', roles, attributes: {}, ...(tenantId === undefined ? {} : { tenantId }) };
  }
}

function valueOf(settings: readonly string[], key: string): string | undefined {
  return settings.find((setting) => setting.startsWith(key + '='))?.slice(key.length + 1);
}

// TODO(platform): replace the development authenticator by a real adapter of Authenticator (a JWT verifier, your identity provider) before the first deployment.
export function createAuthenticator(config: AppConfig): Authenticator {
  return new DevelopmentHeaderAuthenticator(config.environment);
}

export function principalOf(authenticator: Authenticator): (raw: unknown) => Promise<Actor> {
  return (raw) => authenticator.authenticate(developmentActorOf(raw));
}

function developmentActorOf(raw: unknown): string | undefined {
  if (typeof raw !== 'object' || raw === null || !('headers' in raw)) return undefined;
  const { headers } = raw;
  const value: unknown = typeof headers === 'object' && headers !== null ? Reflect.get(headers, DEVELOPMENT_ACTOR_HEADER) : undefined;
  return typeof value === 'string' ? value : undefined;
}

/** For tools that compose the application without serving it (contract generation): no credential is accepted. */
export const offlineAuthenticator: Authenticator = {
  authenticate: () => Promise.reject(new InvalidCredentialError('OFFLINE')),
};
