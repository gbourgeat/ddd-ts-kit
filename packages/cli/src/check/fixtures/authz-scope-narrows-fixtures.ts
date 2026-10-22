import type { Fixture } from './fixture';
import type { FixtureFiles } from './fixture-files';
import { PATHS } from './paths';
import { project } from './project';
import { SAMPLES } from './samples';
import { source } from './source';

const { BILLING, QUERY_HANDLER, QUERY_HANDLER_SPEC } = PATHS;
const PERMISSIONS = `${BILLING}/application/authorization/billing.permissions.ts`;
const SIGNED_IN = 'src/platform/auth/authorization/signed-in-grants.ts';
const AUTHORIZER = 'src/platform/auth/authorization/create-authorizer.ts';

const DECLARED = source(
  "import { definePermissions } from '@ddd-ts-kit/auth';",
  '',
  "export const billingPermissions = definePermissions('billing', {",
  "  'invoice.search': { description: 'Search invoice' },",
  "  'invoice.issue': { description: 'Issue invoice' },",
  '});',
);

const rule = 'authz/scope-narrows';

export const AUTHZ_SCOPE_NARROWS_FIXTURES: readonly Fixture[] = [
  {
    ruleId: rule,
    name: 'a search narrowed by a permission the model decides',
    expect: 'pass',
    files: searching("[billingPermissions['invoice.issue']]"),
  },
  {
    ruleId: rule,
    name: 'a search narrowed by a permission, in a project without signed-in grants',
    expect: 'pass',
    files: project({ [PERMISSIONS]: DECLARED, [QUERY_HANDLER]: handler(), [QUERY_HANDLER_SPEC]: SAMPLES.SPEC }),
  },
  {
    ruleId: rule,
    name: 'a signed-in grant named in a comment only',
    expect: 'pass',
    files: searching("[\n  // billingPermissions['invoice.search'],\n]"),
  },
  {
    ruleId: rule,
    name: 'a search narrowed by a permission every signed-in person holds by its entry',
    expect: { file: QUERY_HANDLER },
    files: searching("[billingPermissions['invoice.search']]"),
  },
  {
    ruleId: rule,
    name: 'a search narrowed by a permission every signed-in person holds through the wildcard of its context',
    expect: { file: QUERY_HANDLER },
    files: searching("['billing:*']"),
  },
  {
    ruleId: rule,
    name: 'a search narrowed by a permission every signed-in person holds through the bare wildcard',
    expect: { file: QUERY_HANDLER },
    files: searching("['*']"),
  },
  {
    ruleId: rule,
    name: 'a search narrowed by a permission held in a constant of the handler, which every signed-in person holds',
    expect: { file: QUERY_HANDLER },
    files: searching("[billingPermissions['invoice.search']]", {
      before: "const searched = billingPermissions['invoice.search'];",
      permission: 'searched',
    }),
  },
  {
    ruleId: rule,
    name: 'a search narrowed by a permission held in a field of the handler, which every signed-in person holds',
    expect: { file: QUERY_HANDLER },
    files: searching("[billingPermissions['invoice.search']]", {
      field: "private readonly searched = billingPermissions['invoice.search'];",
      permission: 'this.searched',
    }),
  },
  {
    ruleId: rule,
    name: 'a search narrowed by a permission handed in, which the checker cannot read',
    expect: { file: QUERY_HANDLER },
    files: searching("[billingPermissions['invoice.issue']]", { permission: 'query.permission' }),
  },
  {
    ruleId: rule,
    name: 'a search narrowed by a permission the grants given in place to the authorizer hold',
    expect: { file: QUERY_HANDLER },
    files: authorizing("grants: [billingPermissions['invoice.search']]"),
  },
  {
    ruleId: rule,
    name: 'a search narrowed by a permission the model decides, the grants given in place to the authorizer',
    expect: 'pass',
    files: authorizing("grants: ['billing:invoice.issue']"),
  },
  {
    ruleId: rule,
    name: 'grants given to the authorizer by a call, which the checker cannot read',
    expect: { file: AUTHORIZER },
    files: authorizing('grants: grantsOf(billingPermissions)'),
  },
];

interface Narrowing {
  /** A statement of the file before the class. */
  readonly before?: string;
  /** A member of the class before its constructor. */
  readonly field?: string;
  /** The second argument of the call. */
  readonly permission?: string;
}

function searching(grants: string, narrowing: Narrowing = {}): FixtureFiles {
  return project({
    [PERMISSIONS]: DECLARED,
    [QUERY_HANDLER]: handler(narrowing),
    [QUERY_HANDLER_SPEC]: SAMPLES.SPEC,
    [SIGNED_IN]: source(
      "import type { Grant } from '@ddd-ts-kit/auth';",
      "import { billingPermissions } from '@/contexts/billing/application/authorization/billing.permissions.js';",
      '',
      `export const signedInGrants: readonly Grant[] = ${grants};`,
      '',
      'export const searching = billingPermissions;',
    ),
  });
}

/** A project whose authorizer is given its grants in place: `grants` is the property as written. */
function authorizing(grants: string): FixtureFiles {
  return project({
    [PERMISSIONS]: DECLARED,
    [QUERY_HANDLER]: handler(),
    [QUERY_HANDLER_SPEC]: SAMPLES.SPEC,
    [AUTHORIZER]: source(
      "import { type Authorizer, SignedInGrantsAuthorizer } from '@ddd-ts-kit/auth';",
      "import { billingPermissions } from '@/contexts/billing/application/authorization/billing.permissions.js';",
      '',
      'declare const model: Authorizer;',
      'declare function grantsOf(set: unknown): readonly string[];',
      '',
      'export function createAuthorizer(): Authorizer {',
      `  return new SignedInGrantsAuthorizer({ ${grants}, otherwise: model });`,
      '}',
      '',
      'export const searching = [billingPermissions, grantsOf];',
    ),
  });
}

function handler({ before, field, permission = "billingPermissions['invoice.search']" }: Narrowing = {}): string {
  return source(
    "import type { Access } from '@ddd-ts-kit/auth';",
    "import { billingPermissions } from '@/contexts/billing/application/authorization/billing.permissions.js';",
    "import type { InvoicesIssuedQuery } from '@/contexts/billing/application/queries/invoices-issued/invoices-issued.query.js';",
    '',
    ...(before === undefined ? [] : [before, '']),
    'export class InvoicesIssuedHandler {',
    ...(field === undefined ? [] : [`  ${field}`, '']),
    '  constructor(private readonly access: Access) {}',
    '',
    '  async execute(query: InvoicesIssuedQuery): Promise<unknown> {',
    `    return this.access.scope(query.actor, ${permission}, 'invoice');`,
    '  }',
    '}',
  );
}
