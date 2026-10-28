import { beforeAll, describe, expect, it } from 'vitest';
import { cli, read, tempDir, write } from './helpers';
import { failure, report } from './reports';

const BILLING = 'src/contexts/billing';
const WORLD = `${BILLING}/test/worlds/billing.world.ts`;
const INVOICE_TERM = ['--term', 'Invoice=A request for payment sent to a customer'];

/** `init` with `flags`, then a billing context holding an aggregate, its repository, a port and its adapter, and a port alone: each port comes with its fake. */
function billingProject(label: string, ...flags: string[]): string {
  const root = tempDir(label);

  const run = (...args: string[]): void => {
    expect(cli(root, ...args).code, args.join(' ')).toBe(0);
  };

  run('init', '--authz', 'rbac', ...flags);
  run('generate', 'context', 'billing', '--classification', 'core', ...INVOICE_TERM);
  run('generate', 'aggregate', 'billing', 'Invoice');
  run('generate', 'repository', 'billing', 'Invoice');
  run('generate', 'port', 'billing', 'PaymentGateway');
  run('generate', 'adapter', 'billing', 'PaymentGateway');
  run('generate', 'port', 'billing', 'TaxRates');

  return root;
}

describe('generate test-world, in the declared style', () => {
  let root: string;

  beforeAll(() => {
    root = billingProject('world-declared');
  });

  it('builds the test application on the platform, the context and every fake, given its stored state first', () => {
    const generated = report(cli(root, 'generate', 'test-world', 'billing', '--json'));

    expect(generated.created).toEqual([WORLD]);

    const world = read(root, WORLD);

    expect(world).toContain(
      "import { contextModule, createTestApplication, fake, type ContextModule } from '@ddd-ts-kit/di';",
    );

    expect(world).toContain("import * as billingDeclarations from '@/contexts/billing/billing.declarations';");

    expect(world).toContain(
      "import { InvoiceRepository } from '@/contexts/billing/domain/repositories/invoice.repository';",
    );

    expect(world).toContain("import { FakePaymentGateway } from '@/contexts/billing/test/fakes/payment-gateway.fake';");

    expect(world).toContain(
      'export async function aBillingWorld({ modules = [nobody], given, ...settings }: BillingWorldOptions = {}) {',
    );

    expect(world).toContain(
      'export interface BillingWorldFakes {\n  readonly invoiceRepository: FakeInvoiceRepository;\n  readonly paymentGateway: FakePaymentGateway;\n}',
    );

    expect(world).toContain('  readonly given?: (fakes: BillingWorldFakes) => Promise<void>;');

    expect(world).toContain(
      '  const fakes = { invoiceRepository: new FakeInvoiceRepository(), paymentGateway: new FakePaymentGateway() };\n\n  await given?.(fakes);',
    );

    expect(world).toContain(
      "    ...settings,\n    eventBusFailures: 'as-thrown',\n    modules: [platformTestModule, context, ...modules],",
    );

    expect(world).toContain(
      '    fakes: [fake(InvoiceRepository, fakes.invoiceRepository), fake(PaymentGateway, fakes.paymentGateway)],',
    );

    expect(world).toContain('  return { application, ...fakes };');
    expect(generated.todos).toEqual([]);

    expect(generated.notes).toEqual([
      'Not in the world: FakeTaxRates stands for TaxRates, which no class of the context implements or depends on yet: the test application would refuse its fake. Run again with --force once one does.',
    ]);
  });

  it('keeps an edited world unless asked with --force, as every generator does', () => {
    write(root, WORLD, 'export const edited = true;\n');

    expect(report(cli(root, 'generate', 'test-world', 'billing', '--json')).skipped).toEqual([WORLD]);
    expect(read(root, WORLD)).toBe('export const edited = true;\n');
    expect(report(cli(root, 'generate', 'test-world', 'billing', '--force', '--json')).updated).toEqual([WORLD]);
    expect(read(root, WORLD)).toContain('aBillingWorld');
  });

  it('takes the name of the world from its second argument', () => {
    const generated = report(cli(root, 'generate', 'test-world', 'billing', 'Invoicing', '--json'));

    expect(generated.created).toEqual([`${BILLING}/test/worlds/invoicing.world.ts`]);

    expect(read(root, `${BILLING}/test/worlds/invoicing.world.ts`)).toContain(
      'export async function anInvoicingWorld(',
    );
  });

  it('leaves out, and says so, a fake that is no class, needs arguments or stands for no port of the context, and a second fake of a port', () => {
    write(
      root,
      `${BILLING}/test/fakes/answering-payment-gateway.fake.ts`,
      "import type { PaymentGateway } from '@/contexts/billing/application/ports/payment-gateway.port';\n\nexport class AnsweringPaymentGateway\n  implements PaymentGateway\n{\n}\n",
    );

    write(
      root,
      `${BILLING}/test/fakes/rates.fake.ts`,
      'export class FakeRates extends Map<string, number> {\n  constructor(readonly rates: number[]) {\n    super();\n  }\n}\n',
    );

    write(
      root,
      `${BILLING}/test/fakes/rate-card.fake.ts`,
      "import type { PaymentGateway } from '@/contexts/billing/application/ports/payment-gateway.port';\n\nexport class FakeRateCard implements Record<string, number>, PaymentGateway {\n  constructor(readonly rates: number[]) {}\n}\n",
    );

    write(root, `${BILLING}/test/fakes/clock.fake.ts`, 'export const fakeClock = { now: () => new Date(0) };\n');

    const generated = report(cli(root, 'generate', 'test-world', 'billing', 'Payments', '--json'));

    expect(generated.notes).toEqual([
      `Not in the world: ${BILLING}/test/fakes/clock.fake.ts exports no class.`,
      'Not in the world: FakeRateCard needs constructor arguments: a spec builds it with what it should answer.',
      'Not in the world: FakeRates implements no port of the context (domain/repositories/ or application/ports/).',
      'Not in the world: FakeTaxRates stands for TaxRates, which no class of the context implements or depends on yet: the test application would refuse its fake. Run again with --force once one does.',
      'Not in the world: AnsweringPaymentGateway stands for PaymentGateway, which FakePaymentGateway already fakes.',
    ]);

    expect(read(root, `${BILLING}/test/worlds/payments.world.ts`)).toContain(
      '  readonly invoiceRepository: FakeInvoiceRepository;\n  readonly paymentGateway: FakePaymentGateway;\n}',
    );
  });

  it('refuses a third argument, and a name that does not start with a letter', () => {
    const extra = failure(cli(root, 'generate', 'test-world', 'billing', 'Payments', 'More', '--json'));

    expect(extra.message).toBe('test-world expects 1 to 2 arguments: context, [Name].');
    expect(extra.fix).toBe('Usage: ddd-ts-kit generate test-world <context> [Name]');

    expect(failure(cli(root, 'generate', 'test-world', 'billing', '1st', '--json')).message).toBe(
      '"1st" is not a name.',
    );
  });
});

describe('generate test-world, and the reader of a query', () => {
  it('reads the fake of the reader of a query as standing for its port, and leaves it to the spec that gives its answer', () => {
    const project = billingProject('world-reader');

    expect(
      cli(project, 'generate', 'query', 'billing', 'GetInvoice', '--public', '--term', 'Get=To read one invoice').code,
    ).toBe(0);

    const fake = read(project, `${BILLING}/test/fakes/get-invoice-reader.fake.ts`);

    expect(fake).toContain('export class FakeGetInvoiceReader implements GetInvoiceReader {');
    expect(fake).not.toContain('InMemory');

    expect(report(cli(project, 'generate', 'test-world', 'billing', '--json')).notes).toContain(
      'Not in the world: FakeGetInvoiceReader needs constructor arguments: a spec builds it with what it should answer.',
    );
  });
});

describe('generate test-world, on other stacks', () => {
  it('gives the test application alone to a context without a fake, and says so', () => {
    const root = tempDir('world-empty');

    expect(cli(root, 'init', '--authz', 'rbac').code).toBe(0);
    expect(cli(root, 'generate', 'context', 'billing', '--classification', 'core').code).toBe(0);

    const generated = report(cli(root, 'generate', 'test-world', 'billing', '--json'));
    const world = read(root, WORLD);

    expect(world).toContain(
      "import { contextModule, createTestApplication, type ContextModule } from '@ddd-ts-kit/di';",
    );

    expect(world).not.toContain('fakes');
    expect(world).not.toContain('given');

    expect(world).toContain(
      'export async function aBillingWorld({ modules = [nobody], ...settings }: BillingWorldOptions = {}) {',
    );

    expect(world).toContain('  return { application };');

    expect(generated.notes).toEqual([
      `${BILLING}/test/fakes/ holds no fake the world can build: it gives the test application alone. Generate a port or a repository (each comes with its fake), then run again with --force.`,
    ]);
  });

  it('assembles the context from its module file in the explicit style, and discovers it under discovery', () => {
    const explicit = billingProject('world-explicit', '--style', 'explicit');
    const discovered = billingProject('world-discovered', '--assembly', 'discovery');

    expect(cli(explicit, 'generate', 'test-world', 'billing').code).toBe(0);
    expect(cli(discovered, 'generate', 'test-world', 'billing').code).toBe(0);

    expect(read(explicit, WORLD)).toContain("import { billingModule } from '@/contexts/billing/billing.module';");
    expect(read(explicit, WORLD)).toContain('    modules: [platformTestModule, billingModule, ...modules],');
    expect(read(discovered, WORLD)).toContain("import { discoverContext } from '@ddd-ts-kit/di/discovery';");

    expect(read(discovered, WORLD)).toContain(
      "  const context = await discoverContext('billing', new URL('../../', import.meta.url));",
    );
  });

  it('wires by hand: the buses, the stored state given first, then the repositories announcing what they save', () => {
    const root = billingProject('world-buses', '--di', 'manual');

    expect(cli(root, 'generate', 'test-world', 'billing').code).toBe(0);

    const world = read(root, WORLD);

    expect(world).toContain("import { createTestBuses } from '@ddd-ts-kit/testing';");
    expect(world).toContain('export async function aBillingWorld({ given, ...settings }: BillingWorldOptions = {}) {');

    expect(world).toContain(
      "  await given?.(fakes);\n\n  const buses = createTestBuses({ ...settings, eventBusFailures: 'as-thrown' });",
    );

    expect(world).toContain(
      '  return { ...buses, ...fakes, invoiceRepository: buses.dispatching(fakes.invoiceRepository) };',
    );

    expect(world).not.toContain('@ddd-ts-kit/di');
  });
});

describe('generate test-world, on a context wired by hand without a fake', () => {
  it('gives the buses alone', () => {
    const root = tempDir('world-buses-empty');

    expect(cli(root, 'init', '--authz', 'rbac', '--di', 'manual').code).toBe(0);
    expect(cli(root, 'generate', 'context', 'billing', '--classification', 'core').code).toBe(0);
    expect(cli(root, 'generate', 'test-world', 'billing').code).toBe(0);

    expect(read(root, WORLD)).toContain(
      "export async function aBillingWorld(settings: BillingWorldOptions = {}) {\n  const buses = createTestBuses({ ...settings, eventBusFailures: 'as-thrown' });\n\n  return { ...buses };\n}",
    );
  });
});
