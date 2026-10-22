import { beforeAll, describe, expect, it } from 'vitest';
import { cli, read, tempDir, write } from '../helpers';
import { expectNoFinding } from './expect-no-finding';
import { installAsPublished } from './install-as-published';
import { bin, findingsOf, runIn } from './run-in';
import { SLOW } from './stacks';
import { typeErrors } from './type-errors';

/**
 * The project as a team left it: relationships decided by OpenFGA, Keycloak, Knex and tenants, the
 * schemas of each route its own, before any identity context.
 */
const STACK = [
  '--orm',
  'knex',
  '--validation',
  'class-validator',
  '--authz',
  'rebac',
  '--tenancy',
  'shared-table',
  '--authn',
  'keycloak',
  '--schemas',
  'per-route',
];

/** The authorizer the team wrote: the OpenFGA server of the deployment decides on relationships. */
const OPEN_FGA_AUTHORIZER = `import type { Authorizer } from '@ddd-ts-kit/auth';
import { OpenFgaAuthorizer } from '@ddd-ts-kit/openfga';
import { openFgaClient } from '@ddd-ts-kit/openfga/sdk';
import { relationshipSchema } from '@/platform/auth/relationships/relationship-schema';

/** Where the OpenFGA server of the deployment answers, and the store that holds the tuples of this project. */
const OPEN_FGA = { apiUrl: 'http://openfga:8080', storeId: '01JA0000000000000000000000' };

/** Relationships, decided by the OpenFGA server of the deployment over the model generated from the schema. */
export function createAuthorizer(): Authorizer {
  return new OpenFgaAuthorizer({ client: openFgaClient(OPEN_FGA), schema: relationshipSchema });
}
`;

/**
 * Slow, opt-in (DDD_TS_KIT_E2E=1): `generate context identity --preset identity` in a project that
 * exists and decides on relationships with OpenFGA. The preset wraps that authorizer, reads the
 * organisations of the Keycloak token as tenants, and the project stays green: no finding of any
 * analyzer, formatted, type-checked, its specs passing.
 */
describe.runIf(SLOW)('the identity preset generated into a project that decides with OpenFGA', () => {
  let root: string;

  beforeAll(() => {
    root = generatedInto();
    installAsPublished(root);
  }, 120_000);

  it('wraps the authorizer of the team, and reads the organisations of the token as tenants', () => {
    expect(read(root, 'src/platform/auth/authorization/create-authorizer.ts')).toContain(
      'return new SignedInGrantsAuthorizer({ grants: signedInGrants, otherwise: model });',
    );

    expect(read(root, 'src/platform/auth/authentication/create-authenticator.ts')).toContain(
      "tenantClaim: 'organization'",
    );
  });

  it('has no finding, and is laid out as its formatter wants it', () => {
    expectNoFinding(root);
    expect(findingsOf(root, { command: bin('biome'), args: ['format', '--max-diagnostics=400', '.'] })).toBe('');
  }, 480_000);

  it('type-checks against the sources of the packages, and passes its specs', () => {
    expect(typeErrors(generatedInto())).toBe('');

    const specs = runIn(root, { command: bin('vitest'), args: ['run'] });

    expect(specs).toMatch(/Test Files\s+\d+ passed/);
    expect(specs).not.toContain('failed');
  }, 480_000);
});

function generatedInto(): string {
  const root = tempDir('preset-generated');

  expect(cli(root, 'init', '--package-manager', 'npm', ...STACK).code).toBe(0);

  write(root, 'src/platform/auth/authorization/create-authorizer.ts', OPEN_FGA_AUTHORIZER);
  write(root, 'package.json', withOpenFga(read(root, 'package.json')));

  expect(cli(root, 'generate', 'context', 'identity', '--preset', 'identity').code).toBe(0);

  return root;
}

/** The packages the authorizer imports, at the version of the kit for its own and the peer it names for the client. */
function withOpenFga(manifest: string): string {
  const parsed = JSON.parse(manifest) as { dependencies: Record<string, string> };
  const kit = parsed.dependencies['@ddd-ts-kit/auth'] ?? '*';

  return `${JSON.stringify({ ...parsed, dependencies: { ...parsed.dependencies, '@ddd-ts-kit/openfga': kit, '@openfga/sdk': '0.9.7' } }, null, 2)}\n`;
}
