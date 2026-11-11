import { CONFIG_FILE } from '../../config';
import type { Fixture } from './fixture';
import type { FixtureFiles } from './fixture-files';
import { PATHS } from './paths';
import { project } from './project';
import { SAMPLES } from './samples';
import { withModules } from './with-modules';

const { BILLING } = PATHS;
const { SPEC } = SAMPLES;

const INVOICES = `${BILLING}/invoices`;
const SHARED = `${BILLING}/shared`;

const AGGREGATE = `${INVOICES}/domain/aggregates/invoice.aggregate.ts`;
const HANDLER = `${INVOICES}/application/commands/issue-invoice/issue-invoice.handler.ts`;
const INVOICE_ISSUED = `${INVOICES}/domain/events/invoice-issued.event.ts`;
const ROUTES = `${SHARED}/presentation/http/invoices.routes.ts`;
const MONEY = `${SHARED}/presentation/http/shared/money.schema.ts`;

/** A context laid out as the layout to come: its module with its tests, and `shared/` for what belongs to no module. */
const LAID_OUT: FixtureFiles = {
  [INVOICE_ISSUED]: 'export const invoiceIssued = 1;\n',
  [`${INVOICES}/test/unit/invoice-issued.event.spec.ts`]: SPEC,
  [`${INVOICES}/test/builders/invoice.builder.ts`]: 'export class InvoiceBuilder {}\n',
  [`${INVOICES}/test/fakes/invoice.repository.fake.ts`]: 'export class InvoiceRepositoryFake {}\n',
  [`${SHARED}/infrastructure/persistence/billing.schema.ts`]: "export const billingSchema = 'billing';\n",
  [ROUTES]: 'export class InvoicesRoutes {}\n',
  [MONEY]: 'export const money = 1;\n',
  [`${SHARED}/test/worlds/billing.world.ts`]: 'export class BillingWorld {}\n',
  [`${SHARED}/test/fakes/clock.fake.ts`]: 'export class ClockFake {}\n',
  [`${SHARED}/test/unit/tenant.guard.spec.ts`]: SPEC,
};

const divided = (files: FixtureFiles): FixtureFiles => project(files, withModules({ invoices: {} }));

/**
 * The layout to come of a context divided into modules, read as the layout of today: each module
 * holds its tests (`<module>/test/`), and `shared/` holds what belongs to no module.
 */
export const SHARED_FOLDER_FIXTURES: readonly Fixture[] = [
  {
    ruleId: 'tree/closed',
    name: 'a module that holds its tests, and shared/ for the schema, the route groups and the worlds of the context',
    expect: 'pass',
    files: divided(LAID_OUT),
  },
  {
    ruleId: 'tree/closed',
    name: 'a domain folder in shared/, which holds no model',
    expect: { file: `${SHARED}/domain` },
    files: divided({ [`${SHARED}/domain/events/invoice-issued.event.ts`]: 'export const invoiceIssued = 1;\n' }),
  },
  {
    ruleId: 'tree/closed',
    name: 'a source directly in shared/infrastructure/, outside the directory of its role',
    expect: { file: `${SHARED}/infrastructure/knex.ts` },
    files: divided({ [`${SHARED}/infrastructure/knex.ts`]: 'export const knex = 1;\n' }),
  },
  {
    ruleId: 'naming/suffix',
    name: 'a builder without its suffix in the test folder of a module',
    expect: { file: `${INVOICES}/test/builders/invoice.ts` },
    files: divided({ [`${INVOICES}/test/builders/invoice.ts`]: 'export class InvoiceBuilder {}\n' }),
  },
  {
    ruleId: 'naming/suffix',
    name: 'a world without its suffix in shared/test/',
    expect: { file: `${SHARED}/test/worlds/billing.ts` },
    files: divided({ [`${SHARED}/test/worlds/billing.ts`]: 'export class BillingWorld {}\n' }),
  },
  {
    ruleId: 'test/helper-placed',
    name: 'a helper among the specs of the test folder of a module',
    expect: { file: `${INVOICES}/test/unit/helpers.ts` },
    files: divided({ [`${INVOICES}/test/unit/helpers.ts`]: 'export const helper = 1;\n' }),
  },
  {
    ruleId: 'module/complete',
    name: 'what the context keeps at its own level, held by shared/',
    expect: 'pass',
    files: divided(LAID_OUT),
  },
  {
    ruleId: 'module/complete',
    name: 'an adapter of a module left in shared/, named where it is',
    expect: { file: `${SHARED}/infrastructure/persistence` },
    severity: 'warn',
    files: divided({
      [`${SHARED}/infrastructure/persistence/knex-invoice.repository.ts`]: 'export class KnexInvoiceRepository {}\n',
    }),
  },
  {
    ruleId: 'module/no-cycle',
    name: 'a module and shared/ importing each other: shared/ is no module',
    expect: 'pass',
    files: divided({
      [`${INVOICES}/presentation/http/invoice.dto.ts`]:
        "import { money } from '@/contexts/billing/shared/presentation/http/shared/money.schema.js';\n\nexport const invoiceDto = money;\n",
      [ROUTES]:
        "import { invoiceDto } from '@/contexts/billing/invoices/presentation/http/invoice.dto.js';\n\nexport const invoicesRoutes = invoiceDto;\n",
      [MONEY]: 'export const money = 1;\n',
    }),
  },
  {
    ruleId: 'test/spec-required',
    name: 'an aggregate and a handler of a module whose specs sit in the test folder of the module',
    expect: 'pass',
    files: divided({
      [AGGREGATE]: 'export class Invoice {}\n',
      [`${INVOICES}/test/unit/invoice.aggregate.spec.ts`]: SPEC,
      [`${INVOICES}/test/builders/invoice.builder.ts`]: 'export const anInvoice = 1;\n',
      [HANDLER]: 'export class IssueInvoiceHandler {}\n',
      [`${INVOICES}/test/unit/application/issue-invoice.handler.spec.ts`]: SPEC,
    }),
  },
  {
    ruleId: 'test/spec-required',
    name: 'an aggregate of a module that holds its tests, without a spec',
    expect: { file: AGGREGATE },
    files: divided({
      [AGGREGATE]: 'export class Invoice {}\n',
      [`${INVOICES}/test/builders/invoice.builder.ts`]: 'export const anInvoice = 1;\n',
    }),
  },
  {
    ruleId: 'test/builder-required',
    name: 'an aggregate of a module whose builder sits in shared/test/builders/',
    expect: 'pass',
    files: divided({
      [AGGREGATE]: 'export class Invoice {}\n',
      [`${INVOICES}/test/unit/invoice.aggregate.spec.ts`]: SPEC,
      [`${SHARED}/test/builders/invoice.builder.ts`]: 'export const anInvoice = 1;\n',
    }),
  },
  {
    ruleId: 'test/builder-required',
    name: 'an aggregate of a module that holds its tests, without a builder',
    expect: { file: AGGREGATE },
    files: divided({
      [AGGREGATE]: 'export class Invoice {}\n',
      [`${INVOICES}/test/unit/invoice.aggregate.spec.ts`]: SPEC,
    }),
  },
  {
    ruleId: 'test/acceptance-black-box',
    name: 'an acceptance spec whose data comes from the builders of a module and of shared/',
    expect: 'pass',
    files: divided({
      [AGGREGATE]: 'export class Invoice {}\n',
      [`${INVOICES}/test/unit/invoice.aggregate.spec.ts`]: SPEC,
      [`${INVOICES}/test/builders/invoice.builder.ts`]: 'export const anInvoice = 1;\n',
      [`${SHARED}/test/builders/tenant.builder.ts`]: 'export const aTenant = 1;\n',
      'test/acceptance/us5.acceptance.spec.ts': [
        "import { it } from 'vitest';",
        "import { anInvoice } from '@/contexts/billing/invoices/test/builders/invoice.builder.js';",
        "import { aTenant } from '@/contexts/billing/shared/test/builders/tenant.builder.js';",
        '',
        "it('#US5.02 AC1 an invoice is issued', () => anInvoice + aTenant);",
        '',
      ].join('\n'),
    }),
  },
  {
    ruleId: 'test/acceptance-black-box',
    name: 'an acceptance spec that imports a fake of the test folder of a module',
    expect: { file: 'test/acceptance/us5.acceptance.spec.ts' },
    files: divided({
      [`${INVOICES}/test/fakes/invoice.repository.fake.ts`]: 'export const fake = 1;\n',
      'test/acceptance/us5.acceptance.spec.ts': [
        "import { it } from 'vitest';",
        "import { fake } from '@/contexts/billing/invoices/test/fakes/invoice.repository.fake.js';",
        '',
        "it('#US5.02 AC1 an invoice is issued', () => fake);",
        '',
      ].join('\n'),
    }),
  },
  {
    ruleId: 'config/valid',
    name: 'a module named shared, the folder of what belongs to no module',
    expect: { file: CONFIG_FILE },
    files: project({}, withModules({ shared: {} })),
  },
];
