import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { readTemplate } from '../src/templating';
import { cli, read, write, type CliResult } from './helpers';
import { report } from './reports';
import { initProject } from './support/init-project';

const AUTHORIZER = 'src/platform/auth/authorization/create-authorizer.ts';
const GRANTS = 'src/platform/auth/authorization/signed-in-grants.ts';
const AUTHENTICATOR = 'src/platform/auth/authentication/create-authenticator.ts';
const MAIN_SCHEMA = 'prisma/schema/schema.prisma';
const IDENTITY_MODELS = 'prisma/schema/identity.prisma';

/** The identity preset applied to a project whose platform files were changed before, as a team may have. */
function identityOn(root: string): ReturnType<typeof report> {
  const result: CliResult = cli(root, 'generate', 'context', 'identity', '--preset', 'identity', '--json');

  expect(result.code, result.stderr || result.stdout).toBe(0);

  return report(result);
}

const steps = (written: ReturnType<typeof report>): string => written.todos.map(({ text }) => text ?? '').join('\n');

describe('the identity preset, on a platform the team changed before', () => {
  it('asks the team to wrap an authorizer it cannot find, and updates a grants file already there', () => {
    const root = initProject();

    fs.rmSync(path.join(root, AUTHORIZER));
    write(root, GRANTS, readTemplate('presets/signed-in-grants.ts.tpl'));

    const written = identityOn(root);

    expect(steps(written)).toContain('wrap the authorizer of create-authorizer.ts in new SignedInGrantsAuthorizer');
    expect(written.updated).toContain(GRANTS);
    expect(read(root, GRANTS)).toContain("'identity:*',");
  });

  it('leaves an authorizer already wrapped as it is', () => {
    const root = initProject();
    const wrapped = `// Wrapped by hand in SignedInGrantsAuthorizer.\n${read(root, AUTHORIZER)}`;

    write(root, AUTHORIZER, wrapped);

    const written = identityOn(root);

    expect(steps(written)).toContain('check this grant: every signed-in person now holds the permissions of identity');
    expect(read(root, AUTHORIZER)).toBe(wrapped);
  });

  it('leaves an authenticator that already reads the organisations of the token', () => {
    const root = initProject('--authn', 'keycloak', '--tenancy', 'shared-table');
    const reading = `// Reads tenantClaim: 'organization' by hand.\n${read(root, AUTHENTICATOR)}`;

    write(root, AUTHENTICATOR, reading);
    identityOn(root);

    expect(read(root, AUTHENTICATOR)).toBe(reading);
  });

  it('keeps the partial indexes of Prisma on when the generator already lists them', () => {
    const root = initProject('--orm', 'prisma');

    write(
      root,
      MAIN_SCHEMA,
      read(root, MAIN_SCHEMA).replace(
        'generator client {\n',
        'generator client {\n  previewFeatures = ["partialIndexes"]\n',
      ),
    );

    identityOn(root);

    expect(read(root, MAIN_SCHEMA).match(/partialIndexes/g)).toHaveLength(1);
    expect(read(root, IDENTITY_MODELS)).toContain('model IdentityMember {');
  });

  it('leaves the models of Prisma to the team when the main schema is missing', () => {
    const root = initProject('--orm', 'prisma');

    fs.rmSync(path.join(root, MAIN_SCHEMA));

    expect(identityOn(root).notes).toContain(
      `${MAIN_SCHEMA} does not exist: copy the models of the preset into ${IDENTITY_MODELS} by hand.`,
    );
  });
});
