import { afterEach, describe, expect, it } from '{{tests.module}}';
import { EnvironmentIdentityProviderConnection } from '{{alias.context}}/infrastructure/external/environment-identity-provider-connection.adapter{{alias.ext}}';

const VARIABLES = ['KEYCLOAK_URL', 'KEYCLOAK_REALM', 'IDENTITY_PROVIDER_ADMIN_CLIENT_ID', 'IDENTITY_PROVIDER_ADMIN_CLIENT_SECRET'];
const saved = Object.fromEntries(VARIABLES.map((name) => [name, process.env[name]]));

afterEach(() => {
  for (const name of VARIABLES) {
    const value = saved[name];

    if (value === undefined) {
      Reflect.deleteProperty(process.env, name);
    } else {
      process.env[name] = value;
    }
  }
});

describe('EnvironmentIdentityProviderConnection', () => {
  it('reads the connection when a call needs it, the trailing slash of the address left out', async () => {
    process.env['KEYCLOAK_URL'] = 'http://127.0.0.1:8080/';
    process.env['KEYCLOAK_REALM'] = 'acme';
    process.env['IDENTITY_PROVIDER_ADMIN_CLIENT_ID'] = 'identity-admin';
    process.env['IDENTITY_PROVIDER_ADMIN_CLIENT_SECRET'] = 'local-secret';

    await expect(new EnvironmentIdentityProviderConnection().settings()).resolves.toEqual({
      baseUrl: 'http://127.0.0.1:8080',
      realm: 'acme',
      clientId: 'identity-admin',
      clientSecret: 'local-secret',
    });
  });

  it('names the variable that is missing, never a value', async () => {
    for (const name of VARIABLES) {
      Reflect.deleteProperty(process.env, name);
    }

    await expect(new EnvironmentIdentityProviderConnection().settings()).rejects.toThrow('KEYCLOAK_URL is not set');
  });
});
