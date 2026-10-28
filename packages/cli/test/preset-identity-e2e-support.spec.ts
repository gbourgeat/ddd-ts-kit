import { describe, expect, it } from 'vitest';
import { cli, read } from './helpers';
import { initProject } from './support/init-project';

const SUPPORT = 'test/e2e/support/start-application.ts';
const FAKE = 'FakeIdentityProviderAdmin';

describe('the end-to-end support of a project with the identity preset', () => {
  it('binds the fake identity provider admin in the declared style, so that the outbox settles once an organisation opens', () => {
    const root = initProject('--preset', 'identity');
    const support = read(root, SUPPORT);

    expect(support).toContain(
      "import { FakeIdentityProviderAdmin } from '@/contexts/identity/test/fakes/identity-provider-admin.fake';",
    );

    expect(support).toContain('builder.rebind(IdentityProviderAdmin).toValue(new FakeIdentityProviderAdmin());');
    expect(support).toContain('contextsOfTheRun()');
    expect(cli(root, 'check').stdout).toContain('0 errors, 0 warnings');
  });

  it('binds it in the explicit style, through the module of the context', () => {
    const root = initProject('--di', 'manual', '--http', 'fastify', '--preset', 'identity');
    const support = read(root, SUPPORT);

    expect(support).toContain('identityModule(platform, { identityProvider: new FakeIdentityProviderAdmin() })');

    expect(read(root, 'src/contexts/identity/identity.module.ts')).toContain(
      'outside.identityProvider ?? new KeycloakIdentityProviderAdmin(connection)',
    );
  });

  it('binds it in the support on a test database too', () => {
    const root = initProject('--orm', 'drizzle', '--preset', 'identity');

    expect(read(root, SUPPORT)).toContain(FAKE);
  });

  it('leaves a project without the preset with no fake to bind', () => {
    const root = initProject();

    expect(read(root, SUPPORT)).not.toContain(FAKE);
  });
});
