import { CONFIG_FILE } from '../../config';
import { config } from './config';
import { contextDoc } from './context-doc';
import { declaredProject } from './declared-project';
import type { Fixture } from './fixture';
import type { FixtureFiles } from './fixture-files';
import { PATHS } from './paths';
import { project } from './project';
import { SAMPLES } from './samples';

const { BILLING, HANDLER, HANDLER_SPEC } = PATHS;
const { SPEC } = SAMPLES;

const IN_MODULE = `${BILLING}/invoices/application/commands/issue-invoice/issue-invoice.handler.ts`;
const SPEC_IN_MODULE = `${BILLING}/test/unit/invoices/issue-invoice.handler.spec.ts`;
const INVOICE_ISSUED = `${BILLING}/invoices/domain/events/invoice-issued.event.ts`;
const REMINDER_SENT = `${BILLING}/reminders/domain/events/reminder-sent.event.ts`;

const HANDLER_CLASS =
  "import { CommandHandler } from '@ddd-ts-kit/kernel/declarations';\n\n@CommandHandler(IssueInvoice)\nexport class IssueInvoiceHandler {}\n";

export const MODULE_FIXTURES: readonly Fixture[] = [
  {
    ruleId: 'module/declared',
    name: 'a module named after a term of the glossary, with its row in CONTEXT.md',
    expect: 'pass',
    files: project(
      { [IN_MODULE]: 'export class IssueInvoiceHandler {}\n', [SPEC_IN_MODULE]: SPEC },
      withModules({ invoices: {} }),
    ),
  },
  {
    ruleId: 'module/declared',
    name: 'a module named with a word the glossary does not define',
    expect: { file: CONFIG_FILE },
    files: project({}, withModules({ dunning: {} })),
  },
  {
    ruleId: 'module/declared',
    name: 'a module named after a technical grouping',
    expect: { file: CONFIG_FILE },
    files: project({}, withModules({ 'shared-invoices': {} })),
  },
  {
    ruleId: 'module/declared',
    name: 'a module without its row in the Modules table of CONTEXT.md',
    expect: { file: `${BILLING}/CONTEXT.md` },
    files: project({}, withModules({ invoices: {} }, [])),
  },
  {
    ruleId: 'module/complete',
    name: 'a context whose files are all in its modules, its specs with them, but what it keeps at its own level',
    expect: 'pass',
    files: project(
      {
        [IN_MODULE]: 'export class IssueInvoiceHandler {}\n',
        [SPEC_IN_MODULE]: SPEC,
        [`${BILLING}/infrastructure/persistence/billing.schema.ts`]: "export const billingSchema = 'billing';\n",
        [`${BILLING}/presentation/http/invoices.routes.ts`]: 'export class InvoicesRoutes {}\n',
        [`${BILLING}/presentation/http/shared/money.schema.ts`]: 'export const money = 1;\n',
        [`${BILLING}/test/fakes/invoice.repository.fake.ts`]: 'export class InvoiceRepositoryFake {}\n',
      },
      withModules({ invoices: { classification: 'core' } }),
    ),
  },
  {
    ruleId: 'module/complete',
    name: 'an adapter left at the level of a context divided into modules',
    expect: { file: `${BILLING}/infrastructure/persistence` },
    severity: 'warn',
    files: project(
      {
        [IN_MODULE]: 'export class IssueInvoiceHandler {}\n',
        [SPEC_IN_MODULE]: SPEC,
        [`${BILLING}/infrastructure/persistence/knex-invoice.repository.ts`]: 'export class KnexInvoiceRepository {}\n',
      },
      withModules({ invoices: {} }),
    ),
  },
  {
    ruleId: 'module/complete',
    name: 'the spec of a file of a module left at the level of the context',
    expect: { file: `${BILLING}/test/unit` },
    severity: 'warn',
    files: project(
      { [IN_MODULE]: 'export class IssueInvoiceHandler {}\n', [HANDLER_SPEC]: SPEC },
      withModules({ invoices: {} }),
    ),
  },
  {
    ruleId: 'module/complete',
    name: 'a module where 0.86 put it, under domain/',
    expect: { file: `${BILLING}/domain/invoices` },
    severity: 'warn',
    files: project(
      { [`${BILLING}/domain/invoices/events/invoice-issued.event.ts`]: 'export const invoiceIssued = 1;\n' },
      withModules({ invoices: {} }),
    ),
  },
  {
    ruleId: 'module/complete',
    name: 'a use case left at the level of a context divided into modules',
    expect: { file: `${BILLING}/application/commands` },
    severity: 'warn',
    files: project(
      { [HANDLER]: 'export class IssueInvoiceHandler {}\n', [HANDLER_SPEC]: SPEC },
      withModules({ invoices: {} }),
    ),
  },
  {
    ruleId: 'module/no-cycle',
    name: 'one module importing another, never back',
    expect: 'pass',
    files: project(
      {
        [INVOICE_ISSUED]: 'export const invoiceIssued = 1;\n',
        [REMINDER_SENT]: eventImporting(
          'reminderSent',
          'invoiceIssued',
          '@/contexts/billing/invoices/domain/events/invoice-issued.event.js',
        ),
      },
      withModules({ invoices: {}, reminders: {} }),
    ),
  },
  {
    ruleId: 'module/no-cycle',
    name: 'two modules importing each other',
    expect: { file: INVOICE_ISSUED },
    severity: 'warn',
    files: project(
      {
        [INVOICE_ISSUED]: eventImporting(
          'invoiceIssued',
          'reminderSent',
          '@/contexts/billing/reminders/domain/events/reminder-sent.event.js',
        ),
        [REMINDER_SENT]: eventImporting(
          'reminderSent',
          'invoiceIssued',
          '@/contexts/billing/invoices/domain/events/invoice-issued.event.js',
        ),
      },
      withModules({ invoices: {}, reminders: {} }),
    ),
  },
  {
    ruleId: 'declarations/barrel-current',
    name: 'two modules holding a role file of one name, which the declarations of the context would export twice',
    expect: { file: `${BILLING}/reminders/application/commands/issue-invoice/issue-invoice.handler.ts` },
    files: declaredProject(
      {
        [IN_MODULE]: HANDLER_CLASS,
        [`${BILLING}/reminders/application/commands/issue-invoice/issue-invoice.handler.ts`]: HANDLER_CLASS,
        [SPEC_IN_MODULE]: SPEC,
      },
      withModules({ invoices: {}, reminders: {} }, ['invoices', 'reminders'], 'declared'),
    ),
  },
  {
    ruleId: 'tree/closed',
    name: 'a stray folder inside a module of the model',
    expect: { file: `${BILLING}/invoices/domain/helpers` },
    files: project(
      { [`${BILLING}/invoices/domain/helpers/rounding.ts`]: 'export const rounding = 1;\n' },
      withModules({ invoices: {} }),
    ),
  },
  {
    ruleId: 'tree/closed',
    name: 'a folder of the context that no config declares as a module',
    expect: { file: `${BILLING}/invoices` },
    files: project({
      [`${BILLING}/invoices/domain/events/invoice-issued.event.ts`]: 'export const invoiceIssued = 1;\n',
    }),
  },
  {
    ruleId: 'config/valid',
    name: 'modules written as a list, which no tool would read',
    expect: { file: CONFIG_FILE },
    files: project(
      {},
      {
        [CONFIG_FILE]: config({
          contexts: {
            billing: { classification: 'core', upstreams: ['catalog'], modules: ['invoices'] },
            catalog: { classification: 'supporting', upstreams: [] },
          },
        }),
      },
    ),
  },
  {
    ruleId: 'config/valid',
    name: 'a module named like a role folder, which no other rule takes for one',
    expect: { file: CONFIG_FILE },
    also: ['module/declared', 'module/complete'],
    files: project(
      { [HANDLER]: 'export class IssueInvoiceHandler {}\n', [HANDLER_SPEC]: SPEC },
      withModules({ commands: {} }),
    ),
  },
];

/** Billing divided into the modules of its model named here, each with the row of its purpose unless left out. */
function withModules(
  modules: Readonly<Record<string, object>>,
  rows: readonly string[] = Object.keys(modules),
  style: 'explicit' | 'declared' = 'explicit',
): FixtureFiles {
  const table = rows.map((module) => `| \`${module}\` | What the ${module} hold. |`).join('\n');

  return {
    [CONFIG_FILE]: config({
      contexts: {
        billing: { classification: 'core', upstreams: ['catalog'], modules },
        catalog: { classification: 'supporting', upstreams: [] },
      },
      ...(style === 'declared' ? { stack: { style: 'declared' } } : {}),
    }),
    [`${BILLING}/CONTEXT.md`]:
      rows.length === 0
        ? contextDoc('core')
        : `${contextDoc('core')}\n## Modules\n\n| Module | Purpose |\n|---|---|\n${table}\n`,
  };
}

/** A module of the domain that reads a value of another module. */
function eventImporting(name: string, other: string, path: string): string {
  return `import { ${other} } from '${path}';\n\nexport const ${name} = ${other};\n`;
}
