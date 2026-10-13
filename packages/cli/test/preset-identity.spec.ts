import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { cli, read } from './helpers.js';
import { initFailure } from './support/init-failure.js';
import { initProject } from './support/init-project.js';

const CONTEXT = 'src/contexts/identity';

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

  it('writes the knex and class-validator flavour, and with tenants keeps its tables out of them under a decision record', () => {
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

    expect(cli(root, 'check').stdout).toContain('0 errors, 0 warnings, 6 suppressions');
    expect(reader).toContain('ADR-0001: the identity context is the control plane of the tenants');
    expect(read(root, 'docs/adr/0001-identity-is-the-control-plane-of-the-tenants.md')).toContain('Status: accepted');

    expect(read(root, `${CONTEXT}/presentation/http/organisations/invite-member/invite-member.body.ts`)).toContain(
      '@IsEmail()',
    );

    expect(read(root, `${CONTEXT}/application/integration/publishers/member-joined.publisher.ts`)).toContain(
      'tenantId: event.facts.organisationId',
    );
  });

  it('is refused on a stack it is not written for, with what to change', () => {
    const prisma = initFailure('--orm', 'prisma', '--preset', 'identity');
    const anonymous = initFailure('--authn', 'none', '--preset', 'identity');
    const unknown = initFailure('--preset', 'billing');

    expect(prisma.message).toBe('The identity preset is not written for "stack.orm": "prisma".');
    expect(prisma.fix).toContain('--orm knex or --orm drizzle');
    expect(anonymous.message).toBe('The identity preset is not written for "stack.authn": "none".');
    expect(anonymous.fix).toContain('--authn jwt or --authn keycloak');
    expect(unknown.message).toBe('Unknown preset "billing".');
  });

  it('is written once when it is named twice', () => {
    const root = initProject('--preset', 'identity', '--preset', 'identity');

    expect(read(root, 'src/platform/auth/signed-in-grants.ts').match(/'identity:\*'/g)).toHaveLength(1);
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

    expect(read(keycloak, 'src/platform/auth/create-authenticator.ts')).toContain("tenantClaim: 'organization'");
    expect(read(alone, 'src/platform/auth/create-authenticator.ts')).not.toContain('tenantClaim');
    expect(read(jwt, 'src/platform/auth/create-authenticator.ts')).not.toContain('tenantClaim');
  });
});

describe('the grant of the preset to every signed-in person', () => {
  const AUTHORIZER = 'src/platform/auth/create-authorizer.ts';

  it('is asked before the access model, whatever it is', () => {
    for (const authz of ['rbac', 'abac', 'rebac', 'custom']) {
      const root = initProject('--authz', authz, '--preset', 'identity');

      expect(read(root, AUTHORIZER)).toContain(
        'return new SignedInGrantsAuthorizer({ grants: signedInGrants, otherwise: model });',
      );

      expect(read(root, 'src/platform/auth/signed-in-grants.ts')).toContain("  'identity:*',\n");
    }
  });

  it('leaves an authorizer the generator did not write to the team, with what to do', () => {
    const root = initProject();

    fs.writeFileSync(path.join(root, AUTHORIZER), 'export { createAuthorizer } from "./elsewhere";\n');
    const result = cli(root, 'generate', 'context', 'people', '--preset', 'identity', '--json');

    expect(read(root, 'src/platform/auth/signed-in-grants.ts')).toContain("  'people:*',\n");
    expect(result.stdout).toContain('wrap the authorizer of create-authorizer.ts');
  });
});

describe('generate context --preset identity', () => {
  it('writes the preset into a context of another name, classified as the preset says unless told', () => {
    const root = initProject();
    const result = cli(root, 'generate', 'context', 'people', '--preset', 'identity', '--json');

    expect(result.code).toBe(0);
    expect(read(root, 'ddd-ts-kit.config.json')).toContain('"classification": "generic"');

    expect(read(root, 'src/contexts/people/application/authorization/people.permissions.ts')).toContain(
      "definePermissions('people'",
    );

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
