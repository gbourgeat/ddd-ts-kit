import { describe, expect, it } from 'vitest';
import { cli, exists, read, write } from './helpers';
import { initProject } from './support/init-project';

const CREATE_AUDIT = 'src/platform/audit/create-audit.ts';
const ORGANISATION_OF = 'src/platform/audit/organisation-of-command.ts';

describe('the audit of the identity preset with tenants', () => {
  it('writes a command that succeeded on an organisation in the chain of that organisation', () => {
    const root = initProject('--tenancy', 'shared-table', '--preset', 'identity');

    expect(read(root, CREATE_AUDIT)).toContain(
      'commands: auditMiddleware(trail, { ...source, unitOfWork, onLostRecord, tenantOf: organisationOfCommand }),',
    );

    expect(read(root, CREATE_AUDIT)).toContain(
      "import { organisationOfCommand } from '@/platform/audit/organisation-of-command';",
    );

    const resolver = read(root, ORGANISATION_OF);

    expect(resolver).toContain('return OrganisationSlug.create(message.organisation.slug).value;');

    expect(resolver).toContain(
      '    message instanceof RevokeInvitationCommand\n  ) {\n    return message.organisationId;',
    );

    expect(resolver).toContain(
      ' * The entry of a failure, and the decision of the authorization, stay in the tenant of the token,',
    );

    expect(cli(root, 'check').stdout).toContain('0 errors, 0 warnings');
  });

  it('keeps one chain per tenant of the token without tenants, and leaves a create-audit.ts the team rewrote', () => {
    expect(exists(initProject('--preset', 'identity'), ORGANISATION_OF)).toBe(false);

    const root = initProject('--tenancy', 'shared-table');

    write(root, CREATE_AUDIT, read(root, CREATE_AUDIT).replace('{ ...source, unitOfWork, onLostRecord }', 'options'));

    const result = cli(root, 'generate', 'context', 'identity', '--preset', 'identity', '--json');

    expect(result.code).toBe(0);
    expect(read(root, CREATE_AUDIT)).not.toContain('organisationOfCommand');

    expect(result.stdout).toContain(
      'no longer builds the audit of the commands as init wrote it: give `auditMiddleware` `tenantOf: organisationOfCommand`',
    );
  });
});
