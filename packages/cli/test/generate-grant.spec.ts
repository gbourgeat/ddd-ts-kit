import { describe, expect, it } from 'vitest';
import { checkJsonOf } from './check-support.js';
import { cli, read } from './helpers.js';
import { failure, report } from './reports.js';
import { initProject } from './support/init-project.js';

const ROLES = 'src/platform/auth/roles.ts';
const ROLE = 'src/platform/auth/role.ts';

function command(root: string, name: string, ...flags: readonly string[]) {
  return cli(root, 'generate', 'command', 'billing', name, '--allow-name', ...flags, '--json');
}

function granted(root: string) {
  return checkJsonOf(cli(root, 'check', '--rule', 'authz/granted', '--json')).violations;
}

describe('generate --grant <role>', () => {
  it('grants the permission to the role in the roles of the platform, and adds the role it does not know yet', () => {
    const root = initProject('--context', 'billing:core');
    const generated = report(command(root, 'IssueInvoice', '--permission', 'invoice.issue', '--grant', 'accountant'));

    expect(read(root, ROLE)).toContain("Accountant: 'accountant',");

    expect(read(root, ROLES)).toContain(
      "  [Role.Accountant]: [billingPermissions['invoice.issue']],\n  [Role.System]: [",
    );

    expect(read(root, ROLES)).toMatch(/import \{ billingPermissions \} from '[^']+billing\.permissions';/);

    expect(generated.todos.map(({ text }) => text).join('\n')).toContain(
      'check this grant: the role accountant now holds billing:invoice.issue.',
    );

    expect(granted(root)).toEqual([]);
  });

  it('adds each next permission to the list of the role, laid out the way the formatter of the project does', () => {
    const root = initProject('--context', 'billing:core');

    for (const action of ['issue', 'cancel', 'void', 'refund']) {
      const name = `${action.charAt(0).toUpperCase()}${action.slice(1)}Invoice`;

      expect(command(root, name, '--permission', `invoice.${action}`, '--grant', 'accountant').code).toBe(0);
    }

    expect(
      cli(
        root,
        'generate',
        'query',
        'billing',
        'GetInvoice',
        '--permission',
        'invoice.get',
        '--grant',
        'admin',
        '--allow-name',
      ).code,
    ).toBe(0);

    expect(read(root, ROLES)).toContain(
      [
        "  [Role.Admin]: ['*', billingPermissions['invoice.get']],",
        '  [Role.Accountant]: [',
        "    billingPermissions['invoice.issue'],",
        "    billingPermissions['invoice.cancel'],",
        "    billingPermissions['invoice.void'],",
        "    billingPermissions['invoice.refund'],",
        '  ],',
      ].join('\n'),
    );

    expect(read(root, ROLE).match(/Accountant: 'accountant'/g)).toHaveLength(1);
    expect(granted(root)).toEqual([]);
  });

  it('says the grant is left to do when the permission is generated without one, and check warns on it', () => {
    const root = initProject('--context', 'billing:core');
    const generated = report(command(root, 'IssueInvoice', '--permission', 'invoice.issue'));

    expect(generated.todos.map(({ text }) => text).join('\n')).toContain(
      "grant billingPermissions['invoice.issue'] by name to the roles that hold it (or generate with --grant <role>)",
    );

    expect(granted(root)).toMatchObject([{ ruleId: 'authz/granted', severity: 'warn' }]);
  });

  it('is refused with --public, and where the rights of the project are not roles', () => {
    const root = initProject('--context', 'billing:core');
    const attributes = initProject('--authz', 'abac', '--context', 'billing:core');

    expect(failure(command(root, 'IssueInvoice', '--public', '--grant', 'accountant')).message).toBe(
      '--grant and --public exclude each other.',
    );

    expect(
      failure(command(attributes, 'IssueInvoice', '--permission', 'invoice.issue', '--grant', 'accountant')).message,
    ).toContain('stack.authz is "abac"');

    expect(read(root, ROLES)).not.toContain('Accountant');
  });

  it('grants the permission of a file upload too', () => {
    const root = initProject('--context', 'billing:core');

    const uploaded = cli(
      root,
      'generate',
      'file-upload',
      'billing',
      'AttachInvoiceScan',
      '--path',
      '/invoices/:invoiceId/scan',
      '--allow-name',
      '--permission',
      'invoice.attach-scan',
      '--grant',
      'accountant',
    );

    expect(uploaded.code).toBe(0);
    expect(read(root, ROLES)).toContain("[Role.Accountant]: [billingPermissions['invoice.attach-scan']],");
    expect(granted(root)).toEqual([]);
  });
});
