import { beforeAll, describe, expect, it } from 'vitest';
import { checkJsonOf } from './check-support';
import { cli, exists, read, tempDir, write } from './helpers';

const BILLING = 'src/contexts/billing';
const CONTEXT_MODULE = `${BILLING}/billing.module.ts`;
const INVOICES = `${BILLING}/invoices/invoices.module.ts`;
const PAYMENTS = `${BILLING}/payments/payments.module.ts`;

const TERMS = [
  'Invoice=A request for payment sent to a customer',
  'Issue=To make an invoice final and send it',
  'Payment=Money received for an invoice',
  'Record=To note what was received',
  'Settle=To mark an invoice as paid',
  'Daily=Once a day',
];

describe('the module file of a module of the model, on tsyringe', () => {
  let root: string;

  beforeAll(() => {
    root = projectWithTwoModules('module-files-tsyringe', 'tsyringe');
    generated(root, 'aggregate', 'billing', 'Invoice', '--module', 'invoices');

    generated(
      root,
      'command',
      'billing',
      'IssueInvoice',
      '--aggregate',
      'Invoice',
      '--permission',
      'invoice.issue',
      '--creates',
      '--module',
      'invoices',
    );
  }, 120_000);

  it('is written by generate module and composed once by the module file of the context, run again or not', () => {
    generated(root, 'module', 'billing', 'invoices', '--purpose', 'The invoices.');

    const context = read(root, CONTEXT_MODULE);

    expect(read(root, INVOICES)).toContain('export const invoicesModule = {');
    expect(occurrences(context, 'invoicesModule.register(builder);')).toBe(1);
    expect(occurrences(context, 'invoicesModule.onStart({ resolve });')).toBe(1);
    expect(context).toContain("import { paymentsModule } from '@/contexts/billing/payments/payments.module';");
  });

  it('receives what is generated with --module, each import once, and the module file of the context stays small', () => {
    const module = read(root, INVOICES);

    expect(module).toContain('.handledBy(IssueInvoiceHandler, [InvoiceRepository, IdGenerator, Clock]);');
    expect(module).toContain('.bind(InvoiceRepository)');

    expect(
      occurrences(
        module,
        "import { InvoiceRepository } from '@/contexts/billing/invoices/domain/repositories/invoice.repository';",
      ),
    ).toBe(1);

    expect(read(root, CONTEXT_MODULE)).not.toContain('IssueInvoice');
  });

  it('receives the registration of a use case that changes an aggregate, and the job that sends it, read back by generate e2e', () => {
    generated(
      root,
      'command',
      'billing',
      'SettleInvoice',
      '--aggregate',
      'Invoice',
      '--permission',
      'invoice.settle',
      '--module',
      'invoices',
    );

    generated(
      root,
      'job',
      'billing',
      'SettleDaily',
      '--every',
      '1d',
      '--command',
      'SettleInvoice',
      '--module',
      'invoices',
    );

    const module = read(root, INVOICES);

    expect(module).toContain('.handledBy(SettleInvoiceHandler, [InvoiceRepository]);');
    expect(module).toContain('SettleDailyJob');
    expect(read(root, CONTEXT_MODULE)).not.toContain('Settle');

    generated(root, 'e2e', 'billing', 'SettleInvoice');

    expect(read(root, 'test/e2e/settle-invoice.e2e.spec.ts')).toContain(
      "await application.runJob('billing.settle-daily');",
    );
  });

  it('is accepted by the checks: no tree/closed, no composition/only-in-module', () => {
    expect(errorsOf(root)).toEqual([]);
  });

  it('is the only file the root of a module holds', () => {
    write(root, `${BILLING}/invoices/rounding.ts`, 'export const rounding = 1;\n');

    const { violations } = checkJsonOf(cli(root, 'check', '--rule', 'tree/closed', '--json'));
    const stray = violations.find((violation) => violation.file === `${BILLING}/invoices/rounding.ts`);

    expect(stray?.message).toContain('sits at the root of the module invoices');
    expect(stray?.fix).toContain('only invoices/invoices.module.ts');
    expect(violations.some((violation) => violation.file === INVOICES)).toBe(false);
  });
});

describe('the module file of a module of the model, wired by hand', () => {
  let root: string;

  beforeAll(() => {
    root = projectWithTwoModules('module-files-manual', 'manual');
    generated(root, 'aggregate', 'billing', 'Invoice', '--module', 'invoices');

    generated(
      root,
      'command',
      'billing',
      'IssueInvoice',
      '--aggregate',
      'Invoice',
      '--permission',
      'invoice.issue',
      '--creates',
      '--module',
      'invoices',
    );
  }, 120_000);

  it('is composed by each function of the module file of the context', () => {
    const context = read(root, CONTEXT_MODULE);

    expect(occurrences(context, 'invoicesModule.registerHandlers(platform);')).toBe(1);
    expect(occurrences(context, 'paymentsModule.registerReactions(platform);')).toBe(1);
    expect(occurrences(context, '...invoicesModule.useCases(),')).toBe(1);
    expect(occurrences(context, '...paymentsModule.routes(platform),')).toBe(1);
  });

  it('creates the repository of the use case it registers, with its permission', () => {
    const module = read(root, INVOICES);

    expect(module).toContain('const invoiceRepository = platform.adapter(');
    expect(module).toContain('new IssueInvoiceHandler(invoiceRepository, platform.ids, platform.clock)');
    expect(module).toContain("requires(IssueInvoiceCommand, billingPermissions['invoice.issue'])");
    expect(read(root, CONTEXT_MODULE)).not.toContain('requires(');
  });

  it('registers a use case of another module where the repository it is given is created, never creating a second one', () => {
    generated(
      root,
      'command',
      'billing',
      'SettleInvoice',
      '--aggregate',
      'Invoice',
      '--permission',
      'invoice.settle',
      '--module',
      'payments',
    );

    const invoices = read(root, INVOICES);

    expect(occurrences(invoices, 'const invoiceRepository = platform.adapter(')).toBe(1);
    expect(invoices).toContain('new SettleInvoiceHandler(invoiceRepository');
    expect(read(root, PAYMENTS)).not.toContain('invoiceRepository');

    expect(exists(root, `${BILLING}/payments/application/commands/settle-invoice/settle-invoice.handler.ts`)).toBe(
      true,
    );
  });

  it('is accepted by the checks', () => {
    expect(errorsOf(root)).toEqual([]);
  });
});

describe('a module of the model in the declared style', () => {
  it('has no module file: its classes declare themselves', () => {
    const root = projectWithTwoModules('module-files-declared', 'tsyringe', 'declared');

    expect(exists(root, INVOICES)).toBe(false);
    expect(exists(root, CONTEXT_MODULE)).toBe(false);
  }, 120_000);
});

/** A project wired in the explicit style whose billing is divided into the modules invoices and payments. */
function projectWithTwoModules(label: string, di: string, style = 'explicit'): string {
  const root = tempDir(label);
  const stack = ['--http', 'express', '--validation', 'zod', '--di', di, '--tests', 'vitest', '--orm', 'drizzle'];
  const context = ['context', 'billing', '--classification', 'core', '--purpose', 'Bills customers.'];

  expect(cli(root, 'init', ...stack, '--events', 'outbox', '--style', style).code).toBe(0);
  expect(cli(root, 'generate', ...context, ...TERMS.flatMap((term) => ['--term', term])).code).toBe(0);
  expect(cli(root, 'generate', 'module', 'billing', 'invoices', '--purpose', 'The invoices.').code).toBe(0);
  expect(cli(root, 'generate', 'module', 'billing', 'payments', '--purpose', 'The payments.').code).toBe(0);

  return root;
}

function generated(root: string, ...args: string[]): void {
  const result = cli(root, 'generate', ...args);

  expect(result.code, result.stderr).toBe(0);
}

function errorsOf(root: string): string[] {
  return checkJsonOf(cli(root, 'check', '--json'))
    .violations.filter((violation) => violation.severity === 'error')
    .map((violation) => `${violation.ruleId} ${violation.file}`);
}

function occurrences(text: string, line: string): number {
  return text.split('\n').filter((candidate) => candidate.trim() === line).length;
}
