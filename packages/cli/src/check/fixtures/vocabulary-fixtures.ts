import { CONFIG_FILE } from '../../config';
import { aggregate } from './aggregate';
import { config } from './config';
import type { Fixture } from './fixture';
import type { FixtureFiles } from './fixture-files';
import { PATHS } from './paths';
import { project } from './project';

const { AGGREGATE, AGGREGATE_SPEC, BILLING, CATALOG, PUBLISHED, ROUTES } = PATHS;
const STATUS = `${BILLING}/domain/vocabularies/invoice-status.vocabulary.ts`;
const PERMISSIONS = `${BILLING}/application/authorization/billing.permissions.ts`;
const GRANTS = 'src/platform/auth/roles/roles.ts';
const ROLE = 'src/platform/auth/authorization/role.ts';
const SERVICE = `${BILLING}/domain/services/pricing.service.ts`;
const CATALOG_SERVICE = `${CATALOG}/domain/services/listing.service.ts`;
const CURRENCY = 'src/shared-kernel/currency.vocabulary.ts';
const TABLES = `${BILLING}/infrastructure/persistence/billing.schema.ts`;
const QUERIES = `${BILLING}/infrastructure/persistence/drizzle-invoice.repository.ts`;

const SPECS = {
  [`${BILLING}/test/unit/pricing.service.spec.ts`]: "import { it } from 'vitest';\n\nit('prices', () => undefined);\n",
  [`${CATALOG}/test/unit/listing.service.spec.ts`]: "import { it } from 'vitest';\n\nit('lists', () => undefined);\n",
};

const DECLARED = {
  [STATUS]:
    "export const InvoiceStatus = {\n  Draft: 'draft',\n  Issued: 'issued',\n} as const;\n\nexport type InvoiceStatus = (typeof InvoiceStatus)[keyof typeof InvoiceStatus];\n",
  [PERMISSIONS]:
    "import { definePermissions } from '@ddd-ts-kit/auth';\n\nexport const billingPermissions = definePermissions('billing', {\n  'invoice.issue': { description: 'Issue an invoice' },\n});\n",
  [ROLE]:
    "export const Role = {\n  Admin: 'admin',\n} as const;\n\nexport type Role = (typeof Role)[keyof typeof Role];\n",
  [CURRENCY]:
    "export const Currency = { Euro: 'EUR' } as const;\nexport type Currency = (typeof Currency)[keyof typeof Currency];\n",
};

/** A vocabulary written the way a person documents it: comments, double quotes, a comma in a value, `satisfies`. */
const DOCUMENTED =
  "/** Where an invoice stands. */\nexport const InvoiceStatus = {\n  /** Being written. */\n  Draft: \"draft\",\n  // Sent, final.\n  Issued: 'issued',\n  'on-hold': 'held, until paid',\n} as const satisfies Record<string, string>;\n\n/* The union. */\nexport type InvoiceStatus = (typeof InvoiceStatus)[keyof typeof InvoiceStatus];\n";

const invoice = (status: string): string =>
  `import { InvoiceStatus } from '@/contexts/billing/domain/vocabularies/invoice-status.vocabulary.js';\n\nexport class Invoice {\n  constructor(private readonly status: InvoiceStatus) {}\n\n  isIssued(): boolean {\n    return this.status === ${status};\n  }\n}\n`;

const raw = (name: string, value: string): string => `export const ${name} = '${value}';\n`;

const rule = 'language/declared-vocabulary';

export const VOCABULARY_FIXTURES: readonly Fixture[] = [
  {
    ruleId: rule,
    name: 'values read through their vocabulary; a test and a published language that spell one',
    expect: 'pass',
    files: named({
      ...aggregate(invoice('InvoiceStatus.Issued')),
      [AGGREGATE_SPEC]: "import { it } from 'vitest';\n\nit('reads issued', () => 'issued');\n",
      [PUBLISHED]: "export const contract = { status: 'issued' as string, issued: true };\n",
      [GRANTS]:
        "import { billingPermissions } from '@/contexts/billing/application/authorization/billing.permissions.js';\n\nexport const grants = { [billingPermissions['invoice.issue'].id]: [billingPermissions['invoice.issue']] };\n",
    }),
  },
  {
    ruleId: rule,
    name: 'a project whose config does not name its literals, as 0.5 wrote it',
    expect: 'pass',
    files: project({ ...DECLARED, ...aggregate(invoice("'issued'")), [GRANTS]: raw('grant', 'billing:invoice.issue') }),
  },
  {
    ruleId: rule,
    name: 'a value of a vocabulary written as a string',
    expect: { file: AGGREGATE },
    files: named(aggregate(invoice("'issued'"))),
  },
  {
    ruleId: rule,
    name: 'a permission given by its id where its permission set declares it',
    expect: { file: GRANTS },
    files: named({ [GRANTS]: "export const grants = ['billing:invoice.issue'];\n" }),
  },
  {
    ruleId: rule,
    name: 'a value of a vocabulary spelled as a quoted key',
    expect: { file: AGGREGATE },
    files: named(aggregate("export const labels = { 'issued': 'Issued' };\n")),
  },
  {
    ruleId: rule,
    name: 'an object as const without the union type of its name declares no vocabulary',
    expect: 'pass',
    files: named({
      [STATUS]: "export const InvoiceStatus = {\n  Issued: 'issued',\n} as const;\n",
      ...aggregate("export class Invoice {\n  readonly status = 'issued';\n}\n"),
    }),
  },
  {
    ruleId: rule,
    name: 'a documented vocabulary in double quotes, with a comma in a value and satisfies, still read',
    expect: { file: AGGREGATE },
    files: named({ [STATUS]: DOCUMENTED, ...aggregate(raw('held', 'held, until paid')) }),
  },
  {
    ruleId: rule,
    name: 'a value of the first entry of a documented vocabulary',
    expect: { file: SERVICE },
    files: named({ [STATUS]: DOCUMENTED, [SERVICE]: raw('DRAFT', 'draft') }),
  },
  {
    ruleId: rule,
    name: 'a role of the platform written in a file of the platform',
    expect: { file: GRANTS },
    // This roles file grants nothing by name: the permission of billing is reached by no role.
    also: ['authz/granted'],
    files: named({ [GRANTS]: raw('ISSUER', 'admin') }),
  },
  {
    ruleId: rule,
    name: 'a role of the platform written in a route group of a context, where a guard names it',
    expect: { file: ROUTES },
    files: named({ [ROUTES]: raw('ISSUER', 'admin') }),
  },
  {
    ruleId: rule,
    name: 'a role word in the model of a context, where it may mean something else, and a value of billing in catalog',
    expect: 'pass',
    files: named({ [SERVICE]: raw('ISSUER', 'admin'), [CATALOG_SERVICE]: raw('LISTED', 'issued') }),
  },
  {
    ruleId: rule,
    name: 'storage names of the persistence that spell a value: a column, a table, a schema, a column in a query',
    expect: 'pass',
    files: named({
      [TABLES]:
        "export const invoices = billingSchema.table('issued', {\n  draft: text('draft').notNull(),\n  entity: { name: 'draft', tableName: 'issued', schema: 'draft' },\n});\n",
      [QUERIES]: "export const issued = (knex: Knex) => knex('invoices').where('draft', status).select('issued');\n",
    }),
  },
  {
    ruleId: rule,
    name: 'a stored value in the persistence: the default of a column',
    expect: { file: TABLES },
    files: named({ [TABLES]: "export const invoices = { status: text('status').default('draft') };\n" }),
  },
  {
    ruleId: rule,
    name: 'a stored value in the persistence: a value compared in a query',
    expect: { file: QUERIES },
    files: named({ [QUERIES]: "export const issued = (knex: Knex) => knex('invoices').where('status', 'issued');\n" }),
  },
  {
    ruleId: rule,
    name: 'a value of a vocabulary of the shared kernel, in a context',
    expect: { file: CATALOG_SERVICE },
    files: named({ [CATALOG_SERVICE]: raw('PRICED_IN', 'EUR') }),
  },
  {
    ruleId: rule,
    name: 'a value of a vocabulary of the shared kernel, in the platform',
    expect: { file: GRANTS },
    // This roles file grants nothing by name: the permission of billing is reached by no role.
    also: ['authz/granted'],
    files: named({ [GRANTS]: raw('PRICED_IN', 'EUR') }),
  },
];

/** A project that names its literals, as `init` writes it. */
function named(files: FixtureFiles): FixtureFiles {
  return project({ ...DECLARED, ...SPECS, ...files }, { [CONFIG_FILE]: config({ stack: { literals: 'named' } }) });
}
