import { beforeAll, describe, expect, it } from 'vitest';
import { cli, read, write } from './helpers';
import { git } from './support/git';
import { jsonAt } from './support/json-at';
import { commit, slicedProject } from './support/sliced-project';

const PERMISSIONS = 'src/contexts/billing/billing.permissions.ts';
const ROLES = 'src/platform/auth/roles/roles.ts';

/** Roles keyed every way a team writes them: an entry of the role vocabulary, a string, a template, a name. */
const KEYED_EVERY_WAY = `import type { Grant } from '@ddd-ts-kit/auth';
import { billingPerms } from '@/contexts/billing/billing.permissions';
import { Role } from '@/platform/auth/authorization/role';

export const roles: Readonly<Record<string, readonly Grant[]>> = {
  [Role.Admin]: ['*'],
  'accountant': [billingPerms['invoice.issue']],
  [\`auditor\`]: ['billing:invoice.issue'],
  clerk: ['billing:*'],
  [Role.System]: [],
};
`;

describe('digest --base, on the grants of a permission', () => {
  let root: string;

  beforeAll(() => {
    root = slicedProject();
    git(root, 'checkout', '--quiet', '-b', 'slice/grants');

    write(
      root,
      PERMISSIONS,
      read(root, PERMISSIONS).replace('export const billingPermissions', 'export const billingPerms'),
    );

    write(root, ROLES, KEYED_EVERY_WAY);
    commit(root, 'feat(billing): who issues an invoice');
  });

  it('names each role that holds a permission, whether its key is a string, a template or a name, under the name its set is exported as', () => {
    const digest = cli(root, 'digest', '--base', 'slice/issue-invoice', '--json').json();

    expect(jsonAt(digest, 'contexts')).toEqual([
      expect.objectContaining({
        name: 'billing',
        permissions: [{ name: 'invoice.issue', grants: ['accountant', 'auditor', 'clerk'], change: 'changed' }],
      }),
    ]);
  });

  it('says it in the Markdown too', () => {
    expect(cli(root, 'digest', '--base', 'slice/issue-invoice').stdout).toContain(
      '  - permission changed: `invoice.issue`, granted to `accountant`, `auditor`, `clerk`',
    );
  });
});
