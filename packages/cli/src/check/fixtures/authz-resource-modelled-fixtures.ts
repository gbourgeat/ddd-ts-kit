import { CONFIG_FILE } from '../../config';
import { config } from './config';
import type { Fixture } from './fixture';
import type { FixtureFiles } from './fixture-files';
import { PATHS } from './paths';
import { project } from './project';
import { SAMPLES } from './samples';
import { source } from './source';

const { BILLING, COMMAND, QUERY, QUERY_HANDLER, QUERY_HANDLER_SPEC } = PATHS;
const PERMISSIONS = `${BILLING}/billing.permissions.ts`;
const SCHEMA = 'src/platform/auth/relationships/relationship-schema.ts';
const REBAC = { [CONFIG_FILE]: config({ stack: { authz: 'rebac' } }) };

const DECLARED = source(
  "import { definePermissions } from '@ddd-ts-kit/auth';",
  '',
  "export const billingPermissions = definePermissions('billing', {",
  "  'invoice.issue': { description: 'Issue invoice' },",
  "  'invoice.search': { description: 'Search invoice' },",
  '});',
);

const SEARCH_HANDLER = source(
  "import type { Access } from '@ddd-ts-kit/auth';",
  "import { billingPermissions } from '@/contexts/billing/billing.permissions.js';",
  "import type { InvoicesIssuedQuery } from '@/contexts/billing/application/queries/invoices-issued/invoices-issued.query.js';",
  '',
  'export class InvoicesIssuedHandler {',
  '  constructor(private readonly access: Access) {}',
  '',
  '  async execute(query: InvoicesIssuedQuery): Promise<unknown> {',
  "    return this.access.scope(query.actor, billingPermissions['invoice.search'], 'invoice');",
  '  }',
  '}',
);

const ISSUE = "billingPermissions['invoice.issue']";
const ON_THE_CONTEXT = "resource: () => ({ type: 'context', id: 'billing' })";
const ON_THE_INVOICE = "resource: (command) => ({ type: 'invoice', id: command.invoiceId })";

const rule = 'authz/resource-modelled';

export const AUTHZ_RESOURCE_MODELLED_FIXTURES: readonly Fixture[] = [
  {
    ruleId: rule,
    name: 'a permission derived on the invoice, checked on the invoice',
    expect: 'pass',
    files: requiring(ON_THE_INVOICE, elements(`[${ISSUE}.id]: 'owner'`)),
  },
  {
    ruleId: rule,
    name: 'a permission no element derives, checked on the context',
    expect: 'pass',
    files: requiring(ON_THE_CONTEXT, elements()),
  },
  {
    ruleId: rule,
    name: 'a relation derived on the invoice that is no permission (edit), a permission checked on the context',
    expect: 'pass',
    files: requiring(ON_THE_CONTEXT, elements("edit: 'owner'")),
  },
  {
    ruleId: rule,
    name: 'a permission derived on the context itself, checked on the context',
    expect: 'pass',
    files: requiring(ON_THE_CONTEXT, elements(), { context: `[${ISSUE}.id]: 'operator'` }),
  },
  {
    ruleId: rule,
    name: 'a permission derived on an element, in a project whose rights are roles',
    expect: 'pass',
    files: requiring(ON_THE_CONTEXT, elements(`[${ISSUE}.id]: 'owner'`), { overrides: { stack: { authz: 'rbac' } } }),
  },
  {
    ruleId: rule,
    name: 'a permission derived on the invoice, checked on the context',
    expect: { file: COMMAND },
    files: requiring(ON_THE_CONTEXT, elements(`[${ISSUE}.id]: 'owner'`)),
  },
  {
    ruleId: rule,
    name: 'a permission derived on the invoice by its id, checked on the context',
    expect: { file: COMMAND },
    files: requiring(ON_THE_CONTEXT, elements("'billing:invoice.issue': 'owner'")),
  },
  {
    ruleId: rule,
    name: 'a permission derived on the invoice by a constant of the schema file, checked on the context',
    expect: { file: COMMAND },
    files: requiring(ON_THE_CONTEXT, elements("[issue]: 'owner'", { before: `const issue = ${ISSUE}.id;` })),
  },
  {
    ruleId: rule,
    name: 'a permission derived on the invoice in the schema written in place, checked on the context',
    expect: { file: COMMAND },
    files: requiring(ON_THE_CONTEXT, inline(`[${ISSUE}.id]: 'owner'`)),
  },
  {
    ruleId: rule,
    name: 'a search whose gate and scope share a permission the schema derives on the invoice',
    expect: { file: QUERY },
    files: searching(),
  },
  {
    ruleId: rule,
    name: 'a search whose gate is on the context, which still derives every permission, the scope on the invoice',
    expect: 'pass',
    files: searching(
      "context: { relations: { operator: ['user'] }, derived: Object.fromEntries(permissions.all().map((permission) => [permission.id, 'operator'])) }",
    ),
  },
  {
    ruleId: rule,
    name: 'a schema whose types are given by a call',
    expect: { file: SCHEMA },
    files: requiring(ON_THE_INVOICE, written('defineSchema(typesOf())')),
  },
  {
    ruleId: rule,
    name: 'a type written as a shorthand property',
    expect: { file: SCHEMA },
    files: requiring(ON_THE_INVOICE, written('defineSchema({ user: {}, invoice })')),
  },
  {
    ruleId: rule,
    name: 'a type held in a constant of the file',
    expect: { file: SCHEMA },
    files: requiring(ON_THE_INVOICE, written('defineSchema({ user: {}, invoice: invoiceType })')),
  },
  {
    ruleId: rule,
    name: 'the derived relations of a type given by a call',
    expect: { file: SCHEMA },
    files: requiring(ON_THE_INVOICE, written('defineSchema({ user: {}, invoice: { derived: derivedOf() } })')),
  },
  {
    ruleId: rule,
    name: 'a derived key held in a constant the file does not declare',
    expect: { file: SCHEMA },
    files: requiring(ON_THE_INVOICE, elements("[issue]: 'owner'")),
  },
  {
    ruleId: rule,
    name: 'a search whose gate is on the context, which lists the permission among those it derives, the scope on the invoice',
    expect: 'pass',
    files: searching(
      "context: { relations: { operator: ['user'] }, derived: { [billingPermissions['invoice.search'].id]: 'operator' } }",
    ),
  },
  {
    ruleId: rule,
    name: 'a search whose gate is on the context, which derives only the permissions no element derives',
    expect: { file: QUERY },
    files: searching(
      "context: { relations: { operator: ['user'] }, derived: Object.fromEntries(permissions.all().filter((permission) => !modelled.has(permission.id)).map((permission) => [permission.id, 'operator'])) }",
    ),
  },
  {
    ruleId: rule,
    name: 'a requirement whose permission the checker cannot read',
    expect: 'pass',
    files: requiring(ON_THE_INVOICE, elements(`[${ISSUE}.id]: 'owner'`), { permission: 'permissionHeldElsewhere' }),
  },
  {
    ruleId: rule,
    name: 'a requirement with no resource, for a permission derived on the invoice',
    expect: { file: COMMAND },
    files: requiring('', elements(`[${ISSUE}.id]: 'owner'`)),
  },
  {
    ruleId: rule,
    name: 'a requirement whose resource the checker cannot read, for a permission derived on the invoice',
    expect: { file: COMMAND },
    files: requiring('resource: resourceOf', elements(`[${ISSUE}.id]: 'owner'`)),
  },
  {
    ruleId: rule,
    name: 'a schema that spreads something other than its elements',
    expect: { file: SCHEMA },
    files: requiring(
      ON_THE_INVOICE,
      source(
        "import { defineSchema } from '@ddd-ts-kit/auth/rebac';",
        '',
        'export const relationshipSchema = defineSchema({ user: {}, ...others });',
      ),
    ),
  },
  {
    ruleId: rule,
    name: 'a schema built by a call',
    expect: { file: SCHEMA },
    files: requiring(ON_THE_INVOICE, source('export const relationshipSchema = buildSchema();')),
  },
  {
    ruleId: rule,
    name: 'a derived key computed in a way the checker cannot resolve',
    expect: { file: SCHEMA },
    files: requiring(ON_THE_INVOICE, elements("[permissionOf('invoice.issue')]: 'owner'")),
  },
];

/** A schema file whose `defineSchema` call is as written. */
function written(call: string): string {
  return source(
    "import { defineSchema } from '@ddd-ts-kit/auth/rebac';",
    '',
    `export const relationshipSchema = ${call};`,
  );
}

interface Placing {
  readonly before?: string;
}

/** The schema of the platform with the elements in `elements`; `derived` is the body of the derived relations of the invoice. */
function elements(derived = "edit: 'owner'", { before }: Placing = {}): string {
  return source(
    "import { defineSchema, type SchemaDefinition } from '@ddd-ts-kit/auth/rebac';",
    "import { billingPermissions } from '@/contexts/billing/billing.permissions.js';",
    '',
    ...(before === undefined ? [] : [before, '']),
    'const elements: SchemaDefinition = {',
    `  invoice: { relations: { owner: ['user'] }, derived: { ${derived} } },`,
    '};',
    '',
    'export const relationshipSchema = defineSchema({',
    '  user: {},',
    "  context: { relations: { operator: ['user'] } },",
    '  ...elements,',
    '});',
    '',
    'export const used = billingPermissions;',
  );
}

/** A schema written as projects generated before `elements` wrote it: the invoice in place, the context deriving `derived` too. */
function inline(derived: string): string {
  return source(
    "import { defineSchema } from '@ddd-ts-kit/auth/rebac';",
    "import { billingPermissions } from '@/contexts/billing/billing.permissions.js';",
    '',
    'export const relationshipSchema = defineSchema({',
    '  user: {},',
    "  context: { relations: { operator: ['user'] } },",
    `  invoice: { relations: { owner: ['user'] }, derived: { ${derived} } },`,
    '});',
    '',
    'export const used = billingPermissions;',
  );
}

function requiring(
  resource: string,
  schema: string,
  {
    context,
    overrides = {},
    permission = ISSUE,
  }: { context?: string; overrides?: Record<string, unknown>; permission?: string } = {},
): FixtureFiles {
  return project(
    {
      [PERMISSIONS]: DECLARED,
      [SCHEMA]:
        context === undefined
          ? schema
          : schema.replace(
              "context: { relations: { operator: ['user'] } }",
              `context: { relations: { operator: ['user'] }, derived: { ${context} } }`,
            ),
      [COMMAND]: source(
        "import { AuthorizedCommand } from '@ddd-ts-kit/kernel';",
        "import { Requires } from '@ddd-ts-kit/kernel/declarations';",
        "import { billingPermissions } from '@/contexts/billing/billing.permissions.js';",
        '',
        `@Requires(${permission}, { ${resource} })`,
        'export class IssueInvoiceCommand extends AuthorizedCommand<void> {}',
      ),
    },
    { [CONFIG_FILE]: config({ stack: { authz: 'rebac' }, ...overrides }) },
  );
}

/** A search gated on the context and narrowed by the same permission, which the schema derives on the invoice. */
function searching(context = "context: { relations: { operator: ['user'] } }"): FixtureFiles {
  return project(
    {
      [PERMISSIONS]: DECLARED,
      [SCHEMA]: elements("[billingPermissions['invoice.search'].id]: 'owner'").replace(
        "context: { relations: { operator: ['user'] } }",
        context,
      ),
      [QUERY]: source(
        "import { AuthorizedQuery } from '@ddd-ts-kit/kernel';",
        "import { Requires } from '@ddd-ts-kit/kernel/declarations';",
        "import { billingPermissions } from '@/contexts/billing/billing.permissions.js';",
        '',
        `@Requires(billingPermissions['invoice.search'], { ${ON_THE_CONTEXT} })`,
        'export class InvoicesIssuedQuery extends AuthorizedQuery<unknown> {}',
      ),
      [QUERY_HANDLER]: SEARCH_HANDLER,
      [QUERY_HANDLER_SPEC]: SAMPLES.SPEC,
    },
    REBAC,
  );
}
