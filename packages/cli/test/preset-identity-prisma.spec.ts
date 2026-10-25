import { describe, expect, it } from 'vitest';
import { cli, read, write } from './helpers';
import { initProject } from './support/init-project';

const CONTEXT = 'src/contexts/identity';
const SCHEMA = 'prisma/schema.prisma';

/** The block of one model or enum of the schema, from its header to its closing brace. */
function blockOf(schema: string, header: string): string {
  const start = schema.indexOf(`${header} {`);

  return start === -1 ? '' : schema.slice(start, schema.indexOf('\n}', start) + 2);
}

describe('the identity preset on Prisma', () => {
  it('lays out the models of the five aggregates in place of the ones the generators started', () => {
    const schema = read(initProject('--orm', 'prisma', '--preset', 'identity'), SCHEMA);
    const member = blockOf(schema, 'model IdentityMember');

    expect(member).toContain('role           IdentityMemberRole');

    expect(member).toContain(
      '@@unique([organisationId, accountId], map: "members_current_idx", where: { removedAt: null })',
    );

    expect(blockOf(schema, 'model IdentityInvitation')).toContain('@unique @map("token_hash")');
    expect(schema.match(/^model IdentityAccount \{/gm)).toHaveLength(1);
    expect(schema).not.toContain('TODO(domain): add one field per field of');
  });

  it('keeps the closed vocabularies as enums of its schema, inside the models of the contexts', () => {
    const schema = read(initProject('--orm', 'prisma', '--preset', 'identity'), SCHEMA);
    const models = schema.slice(schema.indexOf('// ddd-ts-kit:models'), schema.indexOf('// /ddd-ts-kit:models'));

    expect(blockOf(models, 'enum IdentityMemberRole')).toContain('@@schema("identity")');
    expect(blockOf(models, 'enum IdentityAccountStatus')).toContain('deactivated');
    expect(blockOf(models, 'enum IdentityInvitationStatus')).toContain('revoked');
  });

  it('turns on the partial indexes of the client generator once, its assignments aligned', () => {
    const schema = read(initProject('--orm', 'prisma', '--preset', 'identity'), SCHEMA);

    expect(blockOf(schema, 'generator client')).toContain(
      '  importFileExtension = "js"\n  previewFeatures     = ["partialIndexes"]\n}',
    );
  });

  it('adds the partial indexes to the preview features a project already lists', () => {
    const root = initProject('--orm', 'prisma');

    write(
      root,
      SCHEMA,
      read(root, SCHEMA).replace(
        '  importFileExtension = "js"\n',
        '  importFileExtension = "js"\n  previewFeatures     = ["relationJoins"]\n',
      ),
    );

    expect(cli(root, 'generate', 'context', 'identity', '--preset', 'identity').code).toBe(0);
    expect(read(root, SCHEMA)).toContain('previewFeatures     = ["relationJoins", "partialIndexes"]');
  });

  it('writes the Prisma adapters of the context, outside any tenant, and nothing of Knex or Drizzle', () => {
    const root = initProject('--orm', 'prisma', '--tenancy', 'shared-table', '--preset', 'identity');
    const members = read(root, `${CONTEXT}/infrastructure/persistence/prisma-member.repository.ts`);

    expect(members).toContain('where: { organisationId, role: MemberRole.Owner, removedAt: null }');
    expect(members).toContain('// ddd-ts-kit-disable-next-line tenancy/scoped-statement');

    expect(read(root, `${CONTEXT}/infrastructure/persistence/account.personal-fields.ts`)).toContain(
      "fields: ['email', 'display_name'],",
    );

    expect(cli(root, 'check').stdout).toContain('0 errors, 0 warnings');
  });
});
