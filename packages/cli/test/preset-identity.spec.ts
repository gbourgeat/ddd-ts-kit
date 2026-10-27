import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { cli, read } from './helpers';
import { initFailure } from './support/init-failure';
import { initProject } from './support/init-project';

const CONTEXT = 'src/contexts/identity';

interface ConfigShape {
  readonly contexts: Readonly<Record<string, { readonly tenancy?: string }>>;
  readonly deviations: readonly unknown[];
}

/** The line the guide of the project says `check` prints when it passes, `N` read as any count. */
function passingLineOfCheck(guide: string): RegExp {
  const line = /run check:arch`: `([^`]+)`/.exec(guide)?.[1] ?? 'no passing line in AGENTS.md';
  const pattern = line.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(' N ', ' \\d+ ');

  return new RegExp(`^${pattern}$`);
}

describe('init --preset identity', () => {
  it('writes a whole identity context that the checker finds nothing to report in, on the default stack', () => {
    const root = initProject('--context', 'identity:generic', '--preset', 'identity');

    expect(cli(root, 'check').stdout).toContain('0 errors, 0 warnings, 0 suppressions');

    expect(read(root, `${CONTEXT}/domain/aggregates/invitation.aggregate.ts`)).toContain(
      'accept(invitee: Invitee, now: Date)',
    );

    expect(read(root, `${CONTEXT}/infrastructure/persistence/drizzle-member.repository.ts`)).toContain('countOwners');

    expect(
      read(root, `${CONTEXT}/presentation/http/organisations/invite-member/invite-member.controller.ts`),
    ).toContain('z.enum(MemberRole)');

    expect(fs.existsSync(path.join(root, `${CONTEXT}/infrastructure/persistence/knex-member.repository.ts`))).toBe(
      false,
    );

    expect(fs.existsSync(path.join(root, 'docs/adr'))).toBe(false);
  });

  it('declares the context of its name when no --context does, with its purpose, its design, its glossary and its analyzer rules', () => {
    const root = initProject('--preset', 'identity');
    const doc = read(root, `${CONTEXT}/CONTEXT.md`);

    expect(read(root, 'ddd-ts-kit.config.json')).toContain('"identity": {');
    expect(doc).toContain('## Design');
    expect(doc).toContain('Who the people of the application are');
    expect(doc).toContain('| Invitation |');
    expect(doc).not.toContain('TODO(domain)');
    expect(cli(root, 'depcruise-config', '--check').code).toBe(0);
  });

  it('writes the knex and class-validator flavour, and with tenants declares its context outside them under a decision record', () => {
    const root = initProject(
      '--orm',
      'knex',
      '--validation',
      'class-validator',
      '--tenancy',
      'shared-table',
      '--preset',
      'identity',
    );

    const reader = read(root, `${CONTEXT}/infrastructure/persistence/knex-search-members-reader.repository.ts`);

    expect(cli(root, 'check').stdout).toContain('0 errors, 0 warnings, 0 suppressions');
    expect(reader).not.toContain('ddd-ts-kit-disable');
    expect(read(root, 'docs/adr/0001-identity-is-the-control-plane-of-the-tenants.md')).toContain('Status: accepted');

    expect(read(root, `${CONTEXT}/presentation/http/organisations/invite-member/invite-member.body.ts`)).toContain(
      '@IsEmail()',
    );

    expect(read(root, `${CONTEXT}/application/integration/publishers/member-joined.publisher.ts`)).toContain(
      'tenantId: event.facts.organisationId',
    );
  });

  it('answers identifiers with the shared schema and shares the token of an invitation, unless each route keeps its own', () => {
    const http = `${CONTEXT}/presentation/http`;
    const shared = initProject('--validation', 'class-validator', '--preset', 'identity');
    const perRoute = initProject('--validation', 'class-validator', '--schemas', 'per-route', '--preset', 'identity');
    const exists = (root: string, file: string) => fs.existsSync(path.join(root, http, file));

    expect(read(shared, `${http}/accounts/deactivate-account/deactivate-account.controller.ts`)).toContain(
      'body: acceptedSchema',
    );

    expect(exists(shared, 'accounts/deactivate-account/deactivate-account.accepted.ts')).toBe(false);
    expect(read(shared, `${http}/shared/invitation-token.schema.ts`)).toContain('export class InvitationToken');
    expect(exists(shared, 'invitations/decline-invitation/decline-invitation.body.ts')).toBe(false);
    expect(exists(perRoute, 'accounts/deactivate-account/deactivate-account.accepted.ts')).toBe(true);
    expect(exists(perRoute, 'invitations/decline-invitation/decline-invitation.body.ts')).toBe(true);
    expect(exists(perRoute, 'shared/invitation-token.schema.ts')).toBe(false);
  });

  it('is refused on a stack it is not written for, with what to change', () => {
    const typeorm = initFailure('--orm', 'typeorm', '--preset', 'identity');
    const anonymous = initFailure('--authn', 'none', '--preset', 'identity');
    const unknown = initFailure('--preset', 'billing');
    const classes = initFailure('--refusals', 'classes', '--preset', 'identity');

    expect(typeorm.message).toBe('The identity preset is not written for "stack.orm": "typeorm".');
    expect(typeorm.fix).toContain('--orm knex, --orm drizzle or --orm prisma');
    expect(anonymous.message).toBe('The identity preset is not written for "stack.authn": "none".');
    expect(anonymous.fix).toContain('--authn jwt, --authn keycloak or --authn passport');
    expect(unknown.message).toBe('Unknown preset "billing".');
    expect(classes.fix).toContain('--refusals named or --refusals factories');
  });

  it('is written once when it is named twice', () => {
    const root = initProject('--preset', 'identity', '--preset', 'identity');

    expect(read(root, 'src/platform/auth/authorization/signed-in-grants.ts').match(/'identity:\*'/g)).toHaveLength(1);
  });

  it('with tenants, reads the organisations of a Keycloak token as the tenants of the person', () => {
    const keycloak = initProject(
      '--authn',
      'keycloak',
      '--tenancy',
      'shared-table',
      '--orm',
      'knex',
      '--preset',
      'identity',
    );

    const jwt = initProject('--tenancy', 'shared-table', '--orm', 'knex', '--preset', 'identity');
    const alone = initProject('--authn', 'keycloak', '--preset', 'identity');

    expect(read(keycloak, 'src/platform/auth/authentication/create-authenticator.ts')).toContain(
      "tenantClaim: 'organization'",
    );

    expect(read(alone, 'src/platform/auth/authentication/create-authenticator.ts')).not.toContain('tenantClaim');
    expect(read(jwt, 'src/platform/auth/authentication/create-authenticator.ts')).not.toContain('tenantClaim');
  });
});

describe('the passing line of check in the guide of a project with the identity preset and tenants', () => {
  it.each(['drizzle', 'knex', 'prisma'])('is what check prints on the fresh project (%s)', (orm) => {
    const root = initProject('--tenancy', 'shared-table', '--orm', orm, '--preset', 'identity');
    const passing = passingLineOfCheck(read(root, 'AGENTS.md'));
    const printed = cli(root, 'check').stdout.split('\n').at(-1);

    expect(passing.source).toBe('^0 errors, 0 warnings, 0 suppressions in \\d+ files\\.$');
    expect(printed).toMatch(passing);
  });

  it('holds because the context is declared the control plane of the tenants, under the deviation that names its record', () => {
    const root = initProject('--tenancy', 'shared-table', '--orm', 'knex', '--preset', 'identity');
    const config = JSON.parse(read(root, 'ddd-ts-kit.config.json')) as ConfigShape;
    const deviation = { what: 'contexts.identity.tenancy', adr: '0001' };

    expect(config.contexts.identity?.tenancy).toBe('control-plane');
    expect(config.deviations).toContainEqual(expect.objectContaining(deviation));
  });
});

describe('the tenant directory of a project with the identity preset', () => {
  const DIRECTORY = 'src/platform/composition/tenant-directory.ts';

  it.each([
    ['drizzle', 'Drizzle'],
    ['knex', 'Knex'],
    ['prisma', 'Prisma'],
  ])('reads the organisations from the database at each occurrence (%s)', (orm, adapter) => {
    const root = initProject('--tenancy', 'shared-table', '--orm', orm, '--preset', 'identity');
    const directory = read(root, DIRECTORY);

    expect(directory).toContain(`new ${adapter}OrganisationTenantDirectory(persistence.database)`);

    expect(directory).not.toContain('InMemoryTenantDirectory');
    expect(read(root, 'scripts/privacy-erase.ts')).toContain('tenantDirectory(persistence, fixedTenants)');

    expect(
      read(root, `src/contexts/identity/infrastructure/persistence/${orm}-organisation-tenant-directory.reader.ts`),
    ).toContain(`export class ${adapter}OrganisationTenantDirectory implements TenantDirectory`);

    expect(read(root, 'src/contexts/identity/test/integration/organisation-tenant-directory.spec.ts')).toContain(
      'lists an organisation opened after the first read',
    );
  });

  it('keeps the list of TENANTS in the same way without the preset, and writes no file without tenancy', () => {
    const fixed = initProject('--tenancy', 'shared-table');
    const none = initProject('--preset', 'identity');

    expect(read(fixed, DIRECTORY)).toContain('new InMemoryTenantDirectory(fixed)');
    expect(() => read(none, DIRECTORY)).toThrow();
  });

  it('is written for the wired by hand family too', () => {
    const root = initProject('--tenancy', 'shared-table', '--di', 'manual', '--preset', 'identity');

    expect(read(root, DIRECTORY)).toContain('DrizzleOrganisationTenantDirectory');

    expect(read(root, 'src/platform/composition/lay-foundations.ts')).toContain(
      'tenantDirectory(persistence, options.tenants)',
    );
  });
});

describe('the grant of the preset to every signed-in person', () => {
  const AUTHORIZER = 'src/platform/auth/authorization/create-authorizer.ts';

  it('is asked before the access model, whatever it is', () => {
    for (const authz of ['rbac', 'abac', 'rebac', 'custom']) {
      const root = initProject('--authz', authz, '--preset', 'identity');

      expect(read(root, AUTHORIZER)).toContain(
        'return new SignedInGrantsAuthorizer({ grants: signedInGrants, otherwise: model });',
      );

      expect(read(root, 'src/platform/auth/authorization/signed-in-grants.ts')).toContain("  'identity:*',\n");
    }
  });

  it('leaves an authorizer the generator did not write to the team, with what to do', () => {
    const root = initProject();

    fs.writeFileSync(path.join(root, AUTHORIZER), 'export { createAuthorizer } from "./elsewhere";\n');
    const result = cli(root, 'generate', 'context', 'people', '--preset', 'identity', '--json');

    expect(read(root, 'src/platform/auth/authorization/signed-in-grants.ts')).toContain("  'people:*',\n");
    expect(result.stdout).toContain('wrap the authorizer of create-authorizer.ts');
  });
});

describe('generate context --preset identity', () => {
  it('writes the preset into a context of another name, classified as the preset says unless told', () => {
    const root = initProject();
    const result = cli(root, 'generate', 'context', 'people', '--preset', 'identity', '--json');

    expect(result.code).toBe(0);
    expect(read(root, 'ddd-ts-kit.config.json')).toContain('"classification": "generic"');

    expect(read(root, 'src/contexts/people/people.permissions.ts')).toContain("definePermissions('people'");

    expect(read(root, 'src/contexts/people/domain/events/member-joined.event.ts')).toContain("'people.member.joined'");
    expect(cli(root, 'check').stdout).toContain('0 errors');
  });

  it('is refused on a database its tables are not written for, in a config edited by hand', () => {
    const root = initProject('--orm', 'knex');
    const config = path.join(root, 'ddd-ts-kit.config.json');

    fs.writeFileSync(config, fs.readFileSync(config, 'utf8').replace('"database": "postgres"', '"database": "mysql"'));

    const result = cli(root, 'generate', 'context', 'people', '--preset', 'identity');

    expect(result.code).not.toBe(0);
    expect(result.stderr).toContain('The identity preset is not written for "stack.database": "mysql".');
  });

  it('is refused in a project that holds a context of the same preset already, and changes nothing', () => {
    const root = initProject('--preset', 'identity');
    const result = cli(root, 'generate', 'context', 'people', '--preset', 'identity');

    expect(result.code).not.toBe(0);
    expect(result.stderr).toContain('The context identity is written from the identity preset already');
    expect(fs.existsSync(path.join(root, 'src/contexts/people'))).toBe(false);
  });
});

describe('init --preset identity, the form of its refusals', () => {
  it('writes one class per refusal under the codes of the context, or one error class per concept under factories', () => {
    const errors = `${CONTEXT}/domain/errors`;
    const named = initProject('--preset', 'identity');
    const factories = initProject('--refusals', 'factories', '--preset', 'identity');
    const exists = (root: string, file: string) => fs.existsSync(path.join(root, errors, file));

    expect(read(named, `${CONTEXT}/identity.codes.ts`)).toContain("  DeactivatedAccount: 'ACCOUNT_DEACTIVATED',");

    expect(read(named, `${errors}/unknown-member.error.ts`)).toContain('readonly code = IdentityCodes.UnknownMember;');

    expect(read(named, `${CONTEXT}/domain/aggregates/member.aggregate.ts`)).toContain(
      'throw LastOwner.forOrganisation(',
    );

    expect(read(named, `${CONTEXT}/domain/aggregates/member.aggregate.ts`)).not.toContain('MemberError');
    expect(exists(named, 'member.error.ts')).toBe(false);
    expect(cli(factories, 'check').stdout).toContain('0 errors, 0 warnings, 0 suppressions');
    expect(read(factories, `${errors}/member.error.ts`)).toContain('export class MemberError extends ConceptError {');

    expect(read(factories, `${CONTEXT}/domain/aggregates/member.aggregate.ts`)).toContain(
      'throw MemberError.lastOwner(',
    );

    expect(fs.existsSync(path.join(factories, CONTEXT, 'identity.codes.ts'))).toBe(false);
    expect(exists(factories, 'unknown-member.error.ts')).toBe(false);
  });
});
