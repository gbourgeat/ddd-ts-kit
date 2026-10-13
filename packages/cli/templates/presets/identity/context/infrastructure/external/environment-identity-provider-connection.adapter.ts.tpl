import { Adapter } from '@ddd-ts-kit/kernel/declarations';
import { IdentityProviderConnection } from '{{alias.context}}/application/ports/identity-provider-connection.port{{alias.ext}}';

/** The variables read, and what each one holds. */
const VARIABLES = {
  baseUrl: 'KEYCLOAK_URL',
  realm: 'KEYCLOAK_REALM',
  clientId: 'IDENTITY_PROVIDER_ADMIN_CLIENT_ID',
  clientSecret: 'IDENTITY_PROVIDER_ADMIN_CLIENT_SECRET',
} as const;

/**
 * The connection to the administration API of the provider, read from the environment when a call
 * is made: an application that never calls it starts without it. A missing variable fails the
 * call that needed it, with its name; its value is never written.
 */
@Adapter(IdentityProviderConnection, { kind: 'external' })
export class EnvironmentIdentityProviderConnection implements IdentityProviderConnection {
  async settings(): Promise<{ baseUrl: string; realm: string; clientId: string; clientSecret: string }> {
    return {
      baseUrl: variable(VARIABLES.baseUrl).replace(/\/+$/, ''),
      realm: variable(VARIABLES.realm),
      clientId: variable(VARIABLES.clientId),
      clientSecret: variable(VARIABLES.clientSecret),
    };
  }
}

function variable(name: string): string {
  const value = process.env[name] ?? '';

  if (value.trim() === '') {
    throw new Error(`${name} is not set: the administration API of the identity provider is out of reach.`);
  }

  return value;
}
