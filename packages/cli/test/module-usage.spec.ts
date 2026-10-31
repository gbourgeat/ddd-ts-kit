import { beforeAll, describe, expect, it } from 'vitest';
import { KINDS } from '../src/generate/kinds';
import { MODULE_OPTION } from '../src/generate/usage-of';
import { cli, DEFAULT_STACK, tempDir, write } from './helpers';
import { report } from './reports';
import { initFlags } from './support/init-flags';
import { jsonAt } from './support/json-at';

/** The module each context of the project declares: billing and its downstream shipping are both divided. */
const MODULE_OF: Record<string, string> = { billing: 'invoices', shipping: 'parcels' };

/** One run of each kind, in a context divided into modules, on what the project already holds in a module. */
const RUNS: Record<string, { readonly context: string; readonly args: readonly string[] }> = {
  context: { context: 'billing', args: ['context', 'sales', '--classification', 'core'] },
  module: { context: 'billing', args: ['module', 'billing', 'payments', '--purpose', 'The payments of invoices.'] },
  aggregate: { context: 'billing', args: ['aggregate', 'billing', 'CreditNote'] },
  builder: { context: 'billing', args: ['builder', 'billing', 'Payment', '--force'] },
  'test-world': { context: 'billing', args: ['test-world', 'billing'] },
  entity: { context: 'billing', args: ['entity', 'billing', 'InvoiceLine'] },
  'value-object': { context: 'billing', args: ['value-object', 'billing', 'Discount'] },
  property: { context: 'billing', args: ['property', 'billing', 'Money'] },
  vocabulary: { context: 'billing', args: ['vocabulary', 'billing', 'InvoiceKind', '--value', 'standard'] },
  'state-machine': {
    context: 'billing',
    args: [
      'state-machine',
      'billing',
      'Invoice',
      '--value',
      'draft',
      '--value',
      'issued',
      '--transition',
      'issue:draft>issued',
    ],
  },
  'domain-event': { context: 'billing', args: ['domain-event', 'billing', 'Invoice', 'Cancelled'] },
  error: {
    context: 'billing',
    args: ['error', 'billing', 'Invoice', 'alreadyIssued', '--code', 'INVOICE_ALREADY_ISSUED'],
  },
  'domain-error': { context: 'billing', args: ['domain-error', 'billing', 'InvoiceLocked'] },
  'domain-service': { context: 'billing', args: ['domain-service', 'billing', 'Pricing'] },
  repository: { context: 'billing', args: ['repository', 'billing', 'Payment'] },
  command: { context: 'billing', args: ['command', 'billing', 'CancelInvoice', '--permission', 'invoice.cancel'] },
  query: { context: 'billing', args: ['query', 'billing', 'GetInvoice', '--permission', 'invoice.read'] },
  port: { context: 'billing', args: ['port', 'billing', 'TaxRates'] },
  route: {
    context: 'billing',
    args: ['route', 'billing', 'IssueInvoice', '--method', 'POST', '--path', '/invoices', '--force'],
  },
  controller: {
    context: 'billing',
    args: ['controller', 'billing', 'IssueInvoice', '--method', 'POST', '--path', '/invoices', '--force'],
  },
  'file-upload': {
    context: 'billing',
    args: [
      'file-upload',
      'billing',
      'AttachReceipt',
      '--path',
      '/invoices/:invoiceId/receipt',
      '--permission',
      'invoice.attach',
    ],
  },
  'route-group': { context: 'billing', args: ['route-group', 'billing', 'Payments', '--prefix', '/payments'] },
  guard: { context: 'billing', args: ['guard', 'billing', 'ApiKey'] },
  representation: { context: 'billing', args: ['representation', 'billing', 'SearchInvoices', 'csv'] },
  form: { context: 'billing', args: ['form', 'billing', 'IssueInvoice'] },
  schema: { context: 'billing', args: ['schema', 'billing', 'Address'] },
  'integration-event': {
    context: 'billing',
    args: ['integration-event', 'billing', 'Invoice', 'Issued', '--version', '2'],
  },
  'integration-handler': {
    context: 'shipping',
    args: ['integration-handler', 'shipping', 'billing', 'billing.invoice.issued'],
  },
  'erasure-handler': { context: 'billing', args: ['erasure-handler', 'billing'] },
  'event-handler': { context: 'billing', args: ['event-handler', 'billing', 'Invoice', 'Issued'] },
  projection: { context: 'billing', args: ['projection', 'billing', 'InvoiceSummary', 'billing.invoice.issued'] },
  job: { context: 'billing', args: ['job', 'billing', 'RemindOverdue', '--every', '1d', '--command', 'IssueInvoice'] },
  'background-job': {
    context: 'billing',
    args: ['background-job', 'billing', 'SendInvoice', '--command', 'IssueInvoice'],
  },
  process: { context: 'billing', args: ['process', 'billing', 'Dunning'] },
  acl: { context: 'billing', args: ['acl', 'billing', 'LegacyErp'] },
  e2e: { context: 'billing', args: ['e2e', 'billing', 'IssueInvoice'] },
  acceptance: { context: 'billing', args: ['acceptance', 'US1', 'Invoice a customer'] },
  policy: { context: 'billing', args: ['policy', 'billing', 'OnlyIssuerCancels', '--permission', 'invoice.issue'] },
  gateway: { context: 'shipping', args: ['gateway', 'shipping', 'billing', 'InvoiceStatus'] },
  adapter: { context: 'billing', args: ['adapter', 'billing', 'PaymentGateway'] },
  service: { context: 'billing', args: ['service', 'billing'] },
  worker: { context: 'billing', args: ['worker'] },
  adr: { context: 'billing', args: ['adr', 'Keep shipping beside billing'] },
};

const STORY_SLICES = `# Slices

| # | Context | Kind | Slice | Start with | Depends on | Owner | Status |
|---|---|---|---|---|---|---|---|
| US1.01 | billing | skeleton | Invoice | \`generate aggregate billing Invoice\` | | conductor | done |
`;

/** A project whose billing and shipping are divided into modules, holding in them what the runs above build on. */
function projectDividedIntoModules(): string {
  const root = tempDir('module-usage');

  const generate = (...args: string[]): void => {
    const result = cli(root, 'generate', ...args, '--allow-name', '--json');

    expect(result.code, result.stdout).toBe(0);
  };

  const inInvoices = (...args: string[]): void => generate(...args, '--module', 'invoices');

  const init = cli(
    root,
    'init',
    ...initFlags({ ...DEFAULT_STACK, storage: 'local' }),
    '--refusals',
    'classes',
    '--json',
  );

  expect(init.code, init.stdout).toBe(0);
  generate('context', 'billing', '--classification', 'core');
  generate('module', 'billing', 'invoices', '--purpose', 'The invoices from their draft to their payment.');
  inInvoices('aggregate', 'billing', 'Invoice');
  inInvoices('aggregate', 'billing', 'Payment');
  inInvoices('value-object', 'billing', 'Money');
  inInvoices('domain-event', 'billing', 'Invoice', 'Issued');
  inInvoices('repository', 'billing', 'Invoice', '--personal', 'payer');

  inInvoices(
    'command',
    'billing',
    'IssueInvoice',
    '--creates',
    '--aggregate',
    'Invoice',
    '--permission',
    'invoice.issue',
  );

  inInvoices('query', 'billing', 'SearchInvoices', '--permission', 'invoice.search', '--search');
  inInvoices('port', 'billing', 'PaymentGateway');
  inInvoices('route', 'billing', 'IssueInvoice', '--method', 'POST', '--path', '/invoices');
  inInvoices('route', 'billing', 'SearchInvoices', '--method', 'GET', '--path', '/invoices', '--query');
  inInvoices('integration-event', 'billing', 'Invoice', 'Issued');
  generate('context', 'shipping', '--classification', 'supporting', '--upstream', 'billing:customer-supplier');
  generate('module', 'shipping', 'parcels', '--purpose', 'The parcels handed to a carrier.');
  write(root, 'docs/architecture/slices.md', STORY_SLICES);

  return root;
}

interface DryRun {
  readonly code: number;
  /** What it printed: the report, or the refusal. */
  readonly output: string;
  /** The files it would create or change in the module of its context: its layers and its specs. */
  readonly files: readonly string[];
}

/** A dry run of `generate` in a context of the project, read for what it would write in the module of that context. */
function inModule(root: string, context: string, args: readonly string[]): DryRun {
  const module = MODULE_OF[context] ?? '';
  const result = cli(root, 'generate', ...args, '--allow-name', '--dry-run', '--json');
  const said = result.code === 0 ? report(result) : { created: [], updated: [] };
  const files = [...said.created, ...said.updated];
  const prefix = `src/contexts/${context}`;

  return {
    code: result.code,
    output: result.stdout + result.stderr,
    files: files.filter(
      (file) =>
        file.startsWith(`${prefix}/${module}/`) ||
        file.startsWith(`${prefix}/test/unit/${module}/`) ||
        file.startsWith(`${prefix}/test/integration/${module}/`),
    ),
  };
}

describe('the usage of each kind says whether it takes --module', () => {
  let root: string;
  let usages: Map<string, string>;

  beforeAll(() => {
    root = projectDividedIntoModules();

    const kinds = jsonAt(cli(root, 'generate', '--help', '--json').json(), 'kinds');

    usages = new Map(
      (Array.isArray(kinds) ? kinds : []).map((kind: unknown) => [
        String(jsonAt(kind, 'name')),
        String(jsonAt(kind, 'usage')),
      ]),
    );
  }, 120_000);

  it('runs every kind the generator knows', () => {
    expect(Object.keys(RUNS).sort()).toEqual(KINDS.map((kind) => kind.name).sort());
  });

  const kinds = KINDS.map((kind) => [kind.name] as const);

  it.each(kinds)('%s shows --module exactly when the module decides where it writes', (name) => {
    const run = RUNS[name];

    if (run === undefined) {
      throw new Error(`No run of ${name}.`);
    }

    const module = MODULE_OF[run.context] ?? '';
    const given = inModule(root, run.context, [...run.args, '--module', module]);
    const without = inModule(root, run.context, run.args);

    if (usages.get(name)?.endsWith(` ${MODULE_OPTION}`) === true) {
      expect(given.code, given.output).toBe(0);
      expect(given.files).not.toEqual([]);

      // Without it, the kind is refused and asks for it, or writes with the use case or the value object it extends.
      if (without.code === 0) {
        expect(without.files).not.toEqual([]);
      } else {
        expect(without.output).toMatch(new RegExp(`--module <?${module}\\b`));
      }

      return;
    }

    expect(without.code, without.output).toBe(0);
    expect(without.files).toEqual([]);
    expect(given.code).not.toBe(0);
    expect(given.output).toContain(`generate ${name} writes nothing into a module of the model`);
  });

  it('shows --module on the use cases and the model, and keeps it off what the modules share', () => {
    for (const name of ['aggregate', 'command', 'query', 'route', 'port', 'policy', 'integration-handler']) {
      expect(usages.get(name)).toContain(MODULE_OPTION);
    }

    for (const name of ['builder', 'test-world', 'route-group', 'guard', 'schema', 'e2e', 'service', 'worker']) {
      expect(usages.get(name)).not.toContain('--module');
    }
  });
});
