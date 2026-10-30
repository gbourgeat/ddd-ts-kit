import { InvalidCredentialError, type Authenticator } from '@ddd-ts-kit/auth';
import { anonymousActor, type Actor } from '@ddd-ts-kit/kernel';

/** Where a header is believed in place of a credential: nowhere else, production included. */
const BELIEVED_IN = ['development', 'test'];

/**
 * Development only: trusts a header instead of verifying a credential. The header reads
 * `<id>`, `<id>;roles=<a>,<b>` or `<id>;roles=<a>;tenant=<t>`. It exists in development and test
 * only, never in production.
 */
export class DevelopmentHeaderAuthenticator implements Authenticator {
  constructor(environment: string) {
    if (!BELIEVED_IN.includes(environment)) {
      throw new Error(
        'DevelopmentHeaderAuthenticator runs in development and test only, never in production: bind a real adapter of Authenticator',
      );
    }
  }

  async authenticate(credential: string | undefined): Promise<Actor> {
    if (credential === undefined) {
      return anonymousActor();
    }

    const [id = '', ...settings] = credential.split(';').map((part) => part.trim());

    if (id === '') {
      throw new InvalidCredentialError('MALFORMED_DEVELOPMENT_ACTOR');
    }

    const tenantId = valueOf(settings, 'tenant');
    const roles = (valueOf(settings, 'roles') ?? '').split(',').filter((role) => role !== '');

    return { id, type: 'user', roles, attributes: {}, ...(tenantId === undefined ? {} : { tenantId }) };
  }
}

function valueOf(settings: readonly string[], key: string): string | undefined {
  return settings.find((setting) => setting.startsWith(key + '='))?.slice(key.length + 1);
}
