import { CONFIG_FILE } from '../../config/index.js';
import { config } from './config.js';
import { contextDoc } from './context-doc.js';
import type { Fixture } from './fixture.js';
import type { FixtureFiles } from './fixture-files.js';
import { PATHS } from './paths.js';
import { project } from './project.js';
import { SAMPLES } from './samples.js';

const { BILLING, HANDLER, HANDLER_SPEC } = PATHS;
const { SPEC } = SAMPLES;

const IN_MODULE = `${BILLING}/application/invoices/commands/issue-invoice/issue-invoice.handler.ts`;
const INVOICE_ISSUED = `${BILLING}/domain/invoices/events/invoice-issued.event.ts`;
const REMINDER_SENT = `${BILLING}/domain/reminders/events/reminder-sent.event.ts`;

export const MODULE_FIXTURES: readonly Fixture[] = [
  {
    ruleId: 'module/declared',
    name: 'a module named after a term of the glossary, with its row in CONTEXT.md',
    expect: 'pass',
    files: project(
      { [IN_MODULE]: 'export class IssueInvoiceHandler {}\n', [HANDLER_SPEC]: SPEC },
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
    name: 'a context whose files of domain and application are all in its modules',
    expect: 'pass',
    files: project(
      { [IN_MODULE]: 'export class IssueInvoiceHandler {}\n', [HANDLER_SPEC]: SPEC },
      withModules({ invoices: { classification: 'core' } }),
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
          '@/contexts/billing/domain/invoices/events/invoice-issued.event.js',
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
          '@/contexts/billing/domain/reminders/events/reminder-sent.event.js',
        ),
        [REMINDER_SENT]: eventImporting(
          'reminderSent',
          'invoiceIssued',
          '@/contexts/billing/domain/invoices/events/invoice-issued.event.js',
        ),
      },
      withModules({ invoices: {}, reminders: {} }),
    ),
  },
  {
    ruleId: 'tree/closed',
    name: 'a folder of the model that no config declares as a module',
    expect: { file: `${BILLING}/domain/invoices` },
    files: project({
      [`${BILLING}/domain/invoices/events/invoice-issued.event.ts`]: 'export const invoiceIssued = 1;\n',
    }),
  },
  {
    ruleId: 'config/valid',
    name: 'a module named like a role folder',
    expect: { file: CONFIG_FILE },
    also: ['module/declared'],
    files: project({}, withModules({ commands: {} })),
  },
];

/** Billing divided into the modules of its model named here, each with the row of its purpose unless left out. */
function withModules(
  modules: Readonly<Record<string, object>>,
  rows: readonly string[] = Object.keys(modules),
): FixtureFiles {
  const table = rows.map((module) => `| \`${module}\` | What the ${module} hold. |`).join('\n');

  return {
    [CONFIG_FILE]: config({
      contexts: {
        billing: { classification: 'core', upstreams: ['catalog'], modules },
        catalog: { classification: 'supporting', upstreams: [] },
      },
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
