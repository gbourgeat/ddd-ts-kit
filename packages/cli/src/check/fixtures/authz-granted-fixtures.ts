import { CONFIG_FILE } from '../../config/index.js';
import { config } from './config.js';
import type { Fixture } from './fixture.js';
import type { FixtureFiles } from './fixture-files.js';
import { PATHS } from './paths.js';
import { project } from './project.js';
import { source } from './source.js';

const { BILLING } = PATHS;
const PERMISSIONS = `${BILLING}/application/authorization/billing.permissions.ts`;
const ROLES = 'src/platform/auth/roles/roles.ts';
const ROLE = 'src/platform/auth/authorization/role.ts';
const SIGNED_IN = 'src/platform/auth/authorization/signed-in-grants.ts';

const DECLARED = source(
  "import { definePermissions } from '@ddd-ts-kit/auth';",
  '',
  "export const billingPermissions = definePermissions('billing', {",
  "  'invoice.issue': { description: 'Issue invoice' },",
  '});',
);

const ROLE_VOCABULARY = source(
  'export const Role = {',
  "  Admin: 'admin',",
  "  Accountant: 'accountant',",
  '} as const;',
  '',
  'export type Role = (typeof Role)[keyof typeof Role];',
);

const rule = 'authz/granted';

export const AUTHZ_GRANTED_FIXTURES: readonly Fixture[] = [
  {
    ruleId: rule,
    name: 'a permission granted to a role by the entry of its set',
    expect: 'pass',
    files: granting("[Role.Accountant]: [billingPermissions['invoice.issue']],"),
  },
  {
    ruleId: rule,
    name: 'a permission granted through the wildcard of its context',
    expect: 'pass',
    files: granting("[Role.Accountant]: ['billing:*'],"),
  },
  {
    ruleId: rule,
    name: 'a permission granted by its id',
    expect: 'pass',
    files: granting("[Role.Accountant]: ['billing:invoice.issue'],"),
  },
  {
    ruleId: rule,
    name: 'a permission every signed-in person holds through the wildcard of its context',
    expect: 'pass',
    files: {
      ...granting(),
      [SIGNED_IN]: source(
        'export const signedInGrants: readonly string[] = [',
        '  // ddd-ts-kit:signed-in-grants',
        "  'billing:*',",
        '  // /ddd-ts-kit:signed-in-grants',
        '];',
      ),
    },
  },
  {
    ruleId: rule,
    name: 'a permission no role names, in a project whose rights are attributes',
    expect: 'pass',
    files: {
      ...granting(),
      [CONFIG_FILE]: config({ stack: { authz: 'abac' } }),
    },
  },
  {
    ruleId: rule,
    name: 'a permission only the super-admin wildcard reaches',
    expect: { file: PERMISSIONS },
    files: granting(),
  },
  {
    ruleId: rule,
    name: 'a permission granted in a comment only',
    expect: { file: PERMISSIONS },
    files: granting("// [Role.Accountant]: [billingPermissions['invoice.issue']],"),
  },
];

function granting(...grants: readonly string[]): FixtureFiles {
  return project({ [PERMISSIONS]: DECLARED, [ROLE]: ROLE_VOCABULARY, [ROLES]: roles(...grants) });
}

/** A roles file of the platform whose grants are the lines given, after the super-admin. */
function roles(...grants: readonly string[]): string {
  return source(
    "import type { Grant } from '@ddd-ts-kit/auth';",
    "import { billingPermissions } from '@/contexts/billing/application/authorization/billing.permissions.js';",
    "import { Role } from '@/platform/auth/authorization/role.js';",
    '',
    'export const roles: Readonly<Record<string, readonly Grant[]>> = {',
    "  [Role.Admin]: ['*'],",
    ...grants.map((grant) => `  ${grant}`),
    '};',
    '',
    'export const issuing = billingPermissions;',
  );
}
