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
    name: 'the specs of a module in shared/, which holds the worlds, fakes and builders of no module',
    expect: { file: `${SHARED}/test/unit` },
    files: divided({ [`${SHARED}/test/unit/invoice-issued.event.spec.ts`]: SPEC }),
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
    ruleId: 'config/valid',
    name: 'a module named shared, the folder of what belongs to no module',
    expect: { file: CONFIG_FILE },
    files: project({}, withModules({ shared: {} })),
  },
];
