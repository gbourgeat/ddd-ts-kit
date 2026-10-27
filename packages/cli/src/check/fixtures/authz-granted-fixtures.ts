import { CONFIG_FILE } from '../../config';
import { config } from './config';
import type { Fixture } from './fixture';
import type { FixtureFiles } from './fixture-files';
import { PATHS } from './paths';
import { project } from './project';
import { source } from './source';

const { BILLING } = PATHS;
const PERMISSIONS = `${BILLING}/billing.permissions.ts`;
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

const OWN_AUTHORIZER = {
  'src/platform/auth/authorization/create-authorizer.ts': source(
    "import { MyAuthorizer } from '@/platform/auth/authorization/my.authorizer.js';",
    '',
    'export const createAuthorizer = () => new MyAuthorizer();',
  ),
  'src/platform/auth/authorization/my.authorizer.ts': 'export class MyAuthorizer {}\n',
};

const SCHEMA = 'src/platform/auth/relationships/relationship-schema.ts';
const RELATE_OPERATORS = 'src/platform/auth/relationships/relate-operators.ts';
const REBAC = { [CONFIG_FILE]: config({ stack: { authz: 'rebac' } }) };

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
  {
    ruleId: rule,
    name: 'relationships: a permission held on the context, an operator of the context written by a source',
    expect: 'pass',
    files: relating(operatorOf("'context:billing'", "'user:ada'")),
  },
  {
    ruleId: rule,
    name: 'relationships: a permission every signed-in person holds',
    expect: 'pass',
    files: {
      ...relating(),
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
    name: 'relationships: a permission derived on an element, held through relations written at run time',
    expect: 'pass',
    files: relating(undefined, "[billingPermissions['invoice.issue'].id]: 'owner'"),
  },
  {
    ruleId: rule,
    name: 'relationships: an operator written for a context the checker cannot read',
    expect: 'pass',
    files: relating(operatorOf('`context:${context}`', "'user:ada'")),
  },
  {
    ruleId: rule,
    name: 'relationships: a permission held on the context and no operator written anywhere',
    expect: { file: PERMISSIONS },
    files: relating(),
  },
  {
    ruleId: rule,
    name: 'relationships: a permission only a system actor holds, operator of the context',
    expect: 'pass',
    files: relating(operatorOf("'context:billing'", "'system:system:billing.send-reminders'")),
  },
  {
    ruleId: rule,
    name: 'relationships: an authorizer of the project, which may grant what the schema does not',
    expect: 'pass',
    files: { ...relating(), ...OWN_AUTHORIZER },
  },
];

/** A project whose rights are relationships, the schema of `init` deriving on the context what no element derives. */

function relating(operators?: string, element = ''): FixtureFiles {
  return project(
    {
      [PERMISSIONS]: DECLARED,
      [SCHEMA]: source(
        "import { defineSchema, type SchemaDefinition } from '@ddd-ts-kit/auth/rebac';",
        "import { permissions } from '@/platform/auth/authorization/permissions.js';",
        '',
        `const elements: SchemaDefinition = { invoice: { relations: { owner: ['user'] }, derived: { ${element} } } };`,
        '',
        'const modelledOnAnElement = new Set(Object.values(elements).flatMap((element) => Object.keys(element.derived ?? {})));',
        '',
        'export const relationshipSchema = defineSchema({',
        '  user: {},',
        '  system: {},',
        '  context: {',
        "    relations: { operator: ['user', 'system'] },",
        "    derived: Object.fromEntries(permissions.all().filter((permission) => !modelledOnAnElement.has(permission.id)).map((permission) => [permission.id, 'operator'])),",
        '  },',
        '  ...elements,',
        '});',
      ),
      ...(operators === undefined ? {} : { [RELATE_OPERATORS]: operators }),
    },
    REBAC,
  );
}

function operatorOf(object: string, subject: string): string {
  return source(
    "import type { RelationTuple } from '@ddd-ts-kit/auth/rebac';",
    '',
    'const context = "billing";',
    'export const operators: readonly RelationTuple[] = [',
    `  { object: ${object}, relation: 'operator', subject: ${subject} },`,
    '];',
  );
}

function granting(...grants: readonly string[]): FixtureFiles {
  return project({ [PERMISSIONS]: DECLARED, [ROLE]: ROLE_VOCABULARY, [ROLES]: roles(...grants) });
}

/** A roles file of the platform whose grants are the lines given, after the super-admin. */
function roles(...grants: readonly string[]): string {
  return source(
    "import type { Grant } from '@ddd-ts-kit/auth';",
    "import { billingPermissions } from '@/contexts/billing/billing.permissions.js';",
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
