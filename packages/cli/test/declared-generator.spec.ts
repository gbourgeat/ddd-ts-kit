import { beforeAll, describe, expect, it } from 'vitest';
import { cli, exists, read, scaffoldEverything, tempDir, walk, write, type CliResult } from './helpers.js';

const failure = (result: CliResult): { message: string; fix: string } => (result.json() as { error: { message: string; fix: string } }).error;

const BILLING = 'src/contexts/billing';
const SHIPPING = 'src/contexts/shipping';

/** The default way a project is written: each class declares what it is, and no file lists the bindings of a context. */
describe('a context generated in the declared style', () => {
  let root: string;

  beforeAll(() => {
    root = tempDir('declared');
    scaffoldEverything(root);
  });

  it('has no module file: its tokens, the list of its routes and one generated barrel are all that assembles it', () => {
    const billing = walk(root, BILLING).map((file) => file.replace(`${BILLING}/`, ''));

    expect(billing).not.toContain('billing.module.ts');
    expect(billing).toEqual(expect.arrayContaining(['billing.declarations.ts', 'application/ports/billing.ports.ts', 'presentation/http/billing.routes.ts']));
    expect(read(root, `${BILLING}/application/ports/billing.ports.ts`)).toContain("export const INVOICE_REPOSITORY = token<InvoiceRepository>('billing.InvoiceRepository');");
    expect(read(root, `${BILLING}/application/ports/billing.ports.ts`)).toContain("export const PAYMENT_GATEWAY = token<PaymentGateway>('billing.PaymentGateway');");
    expect(read(root, `${BILLING}/presentation/http/billing.routes.ts`)).toContain('issueInvoiceRoute(commands),\n    cancelInvoiceRoute(commands),\n    listInvoicesRoute(queries),');
  });

  it('exports every role file from the barrel, sorted by path, and nothing else', () => {
    expect(read(root, `${BILLING}/billing.declarations.ts`).trimEnd().split('\n')).toEqual([
      "export * from './application/authorization/only-issuer-cancels.policy.js';",
      "export * from './application/commands/cancel-invoice/cancel-invoice.command.js';",
      "export * from './application/commands/cancel-invoice/cancel-invoice.handler.js';",
      "export * from './application/commands/issue-invoice/issue-invoice.command.js';",
      "export * from './application/commands/issue-invoice/issue-invoice.handler.js';",
      "export * from './application/event-handlers/invoice-issued.event-handler.js';",
      "export * from './application/event-handlers/invoice-marked-as-paid.event-handler.js';",
      "export * from './application/integration/publishers/invoice-issued-v2.publisher.js';",
      "export * from './application/integration/publishers/invoice-issued.publisher.js';",
      "export * from './application/queries/list-invoices/list-invoices.handler.js';",
      "export * from './application/queries/list-invoices/list-invoices.query.js';",
      "export * from './infrastructure/external/remote-payment-gateway.adapter.js';",
      "export * from './infrastructure/external/remote-tax-rates.adapter.js';",
      "export * from './infrastructure/persistence/drizzle-invoice.repository.js';",
      "export * from './infrastructure/persistence/in-memory-list-invoices-reader.repository.js';",
    ]);
  });

  it('says who may send a message on the message, and what handles it on the handler, with its tokens', () => {
    const command = read(root, `${BILLING}/application/commands/issue-invoice/issue-invoice.command.ts`);
    const handler = read(root, `${BILLING}/application/commands/issue-invoice/issue-invoice.handler.ts`);

    expect(command).toContain("@Requires(billingPermissions['invoice.issue'])\nexport class IssueInvoiceCommand extends AuthorizedCommand<string> {");
    expect(handler).toContain('@CommandHandler(IssueInvoiceCommand, [INVOICE_REPOSITORY, DOMAIN_EVENTS, ID_GENERATOR, CLOCK])\nexport class IssueInvoiceHandler implements CommandHandler<IssueInvoiceCommand> {');
    expect(handler).toContain("import { CLOCK, CommandHandler, DOMAIN_EVENTS, ID_GENERATOR } from '@ddd-ts-kit/kernel/declarations';");
    expect(read(root, `${BILLING}/application/commands/cancel-invoice/cancel-invoice.handler.ts`)).toContain('@CommandHandler(CancelInvoiceCommand)\n');
    expect(read(root, 'src/contexts/order-fulfilment/application/queries/track-purchase-order/track-purchase-order.query.ts')).toContain('@Public()\nexport class TrackPurchaseOrderQuery extends Query<TrackPurchaseOrderResult> {');
    expect(read(root, `${BILLING}/application/queries/list-invoices/list-invoices.handler.ts`)).toContain('@QueryHandler(ListInvoicesQuery, [LIST_INVOICES_READER, ACCESS])');
    expect(read(root, `${BILLING}/application/queries/list-invoices/list-invoices.handler.ts`)).toContain("import { ACCESS, type Access } from '@ddd-ts-kit/auth';");
  });

  it('binds each adapter by its own declaration: repository, read port, outside system with its policy', () => {
    expect(read(root, `${BILLING}/infrastructure/persistence/drizzle-invoice.repository.ts`)).toContain('@Repository(INVOICE_REPOSITORY, [DATABASE, EXECUTION_SCOPE, CLOCK])\nexport class DrizzleInvoiceRepository implements InvoiceRepository {');
    expect(read(root, `${BILLING}/infrastructure/persistence/drizzle-invoice.repository.ts`)).toContain("import { DATABASE } from '../../../../platform/tokens.js';");
    expect(read(root, `${BILLING}/infrastructure/persistence/in-memory-list-invoices-reader.repository.ts`)).toContain('@Repository(LIST_INVOICES_READER)\nexport class InMemoryListInvoicesReader implements ListInvoicesReader {\n  constructor(private readonly items: readonly ListInvoicesItem[] = []) {}');
    expect(read(root, `${BILLING}/infrastructure/external/remote-payment-gateway.adapter.ts`)).toContain(
      "@Adapter(PAYMENT_GATEWAY, { kind: 'external', aspects: [ownPolicy(retry({ attempts: 3, backoff: { baseMs: 100 } }), timeout(2000))] })\nexport class RemotePaymentGateway implements PaymentGateway {",
    );
    const decorated = read(root, `${BILLING}/infrastructure/external/remote-tax-rates.adapter.ts`);
    expect(decorated).toContain("@Adapter(TAX_RATES, { kind: 'external', aspects: [ownPolicy()] })");
    expect(decorated).toContain('  @Retry({ attempts: 3, backoff: { baseMs: 100 } })\n  @Timeout(2000, { signal: true })\n  async send(');
  });

  it('declares reactions: to a domain event, to publish it, to an integration event of an upstream, and a policy as a class', () => {
    expect(read(root, `${BILLING}/application/event-handlers/invoice-issued.event-handler.ts`)).toContain("@DomainEventHandler(InvoiceIssued, { name: 'billing.invoice.issued' })\nexport class InvoiceIssuedEventHandler {");
    expect(read(root, `${BILLING}/application/integration/publishers/invoice-issued.publisher.ts`)).toContain("@DomainEventHandler(InvoiceIssued, { name: 'billing.invoice.issued' }, [EVENT_PUBLISHER, ID_GENERATOR])\nexport class InvoiceIssuedPublisher {");
    expect(read(root, `${SHIPPING}/application/integration/handlers/billing-invoice-issued.integration-handler.ts`)).toContain(
      "@IntegrationEventHandler(invoiceIssuedV2, { consumer: 'shipping.billing-invoice-issued' }, [COMMAND_BUS])\nexport class BillingInvoiceIssuedHandler {",
    );
    expect(read(root, `${BILLING}/application/authorization/only-issuer-cancels.policy.ts`)).toContain("@Policy(billingPermissions['invoice.cancel'], { name: 'billing.only-issuer-cancels' })\nexport class OnlyIssuerCancelsPolicy {");
    expect(read(root, 'src/platform/auth/access-policies.ts')).not.toContain('OnlyIssuerCancels');
  });

  it('keeps in the platform module the one thing a decorator cannot say: the value a gateway is given, for the application and for the specs', () => {
    const gateway = read(root, `${SHIPPING}/infrastructure/external/in-process-invoice-status.gateway.ts`);
    const platform = read(root, 'src/platform/platform.module.ts');

    expect(gateway).toContain('@Gateway(INVOICE_STATUS_GATEWAY, [INVOICE_STATUS_UPSTREAM])\nexport class InProcessInvoiceStatusGateway implements InvoiceStatusGateway {');
    expect(platform).toContain("import { INVOICE_STATUS_UPSTREAM } from '../contexts/shipping/application/ports/shipping.ports.js';");
    expect(platform).toContain('      // ddd-ts-kit:bindings\n      builder.bind(INVOICE_STATUS_UPSTREAM).toValue({});\n      // /ddd-ts-kit:bindings');
    expect(platform).toContain('    // ddd-ts-kit:test-bindings\n    builder.bind(INVOICE_STATUS_UPSTREAM).toValue({});\n    // /ddd-ts-kit:test-bindings');
    expect(platform).not.toContain('DOMAIN_EVENTS');
  });

  it('is assembled in one line of the composition root, of the entry point of a context run alone, and of the proof that it wires alone', () => {
    const application = read(root, 'src/platform/application.ts');

    expect(application).toContain("import * as billingDeclarations from '../contexts/billing/billing.declarations.js';");
    expect(application).toContain("    contextModule('billing', billingDeclarations),\n    contextModule('shipping', shippingDeclarations),\n    contextModule('order-fulfilment', orderFulfilmentDeclarations),");
    expect(application).toContain('    billingRoutes,\n    shippingRoutes,\n    orderFulfilmentRoutes,');
    expect(application).toContain('routes(container.resolve(COMMAND_BUS), container.resolve(QUERY_BUS))');
    expect(read(root, 'src/apps/shipping/main.ts')).toContain("{ modules: [contextModule('shipping', shippingDeclarations)], routes: [shippingRoutes] },");
    expect(read(root, 'test/architecture/extractable.spec.ts')).toContain("['billing', contextModule('billing', billingDeclarations)],");
  });

  it('tests a handler on the declarations of its context and fakes, in three lines of arrangement', () => {
    const spec = read(root, `${BILLING}/test/unit/issue-invoice.handler.spec.ts`);

    expect(spec).toContain("import * as billingDeclarations from '../../billing.declarations.js';");
    expect(spec).toContain(
      "  const application = createTestApplication({\n    modules: [platformTestModule, contextModule('billing', billingDeclarations), holders],\n    fakes: [fake(INVOICE_REPOSITORY, invoiceRepository)],\n    idPrefix: 'invoice',\n  });",
    );
  });

  it('passes the checker and has its documentation current', () => {
    const result = cli(root, 'check', '--json').json() as { violations: unknown[]; ok: boolean };

    expect(result.violations).toEqual([]);
    expect(result.ok).toBe(true);
    expect(cli(root, 'docs', '--check').code).toBe(0);
  });

  it('refuses a handler of an event its upstream does not declare, and a second adapter for a token', () => {
    const undeclared = cli(root, 'generate', 'integration-handler', 'shipping', 'billing', 'billing.invoice.cancelled', '--json');
    expect(undeclared.code).toBe(2);
    expect(failure(undeclared).message).toBe('billing declares no billing.invoice.cancelled in its published language.');
    expect(failure(undeclared).fix).toContain('ddd-ts-kit generate integration-event billing Invoice Cancelled');

    const second = cli(root, 'generate', 'adapter', 'shipping', 'InvoiceStatusGateway', '--kind', 'gateway', '--json');
    expect(second.code).toBe(2);
    expect(failure(second).message).toBe('InvoiceStatusGateway is already bound by infrastructure/external/in-process-invoice-status.gateway.ts.');
  });

  it('accepts the former name of the integration-handler kind', () => {
    expect(cli(root, 'generate', 'consumer', 'shipping', 'billing', 'billing.invoice.issued', '--dry-run').code).toBe(0);
  });

  it('rewrites the barrel on every generate and on docs, and reports one that a hand-added role file left behind', () => {
    const added = `${SHIPPING}/infrastructure/external/remote-carrier.adapter.ts`;
    write(root, added, "import { Adapter } from '@ddd-ts-kit/kernel/declarations';\nimport { INVOICE_STATUS_UPSTREAM } from '../../application/ports/shipping.ports.js';\n\n@Adapter(INVOICE_STATUS_UPSTREAM)\nexport class RemoteCarrier {}\n");

    const stale = cli(root, 'docs', '--check');
    expect(stale.code).toBe(1);
    expect(stale.stdout).toContain(`stale  ${SHIPPING}/shipping.declarations.ts`);
    expect(cli(root, 'check', '--rule', 'declarations/barrel-current').code).toBe(1);

    expect(cli(root, 'docs').code).toBe(0);
    expect(read(root, `${SHIPPING}/shipping.declarations.ts`)).toContain("export * from './infrastructure/external/remote-carrier.adapter.js';");
    expect(cli(root, 'check', '--rule', 'declarations/barrel-current').code).toBe(0);
  });
});

describe('a declared adapter towards another context', () => {
  it('is a gateway: its file and its decorator say so', () => {
    const root = tempDir('declared');
    cli(root, 'init', '--context', 'billing:core');
    cli(root, 'generate', 'port', 'billing', 'Stock');

    expect(cli(root, 'generate', 'adapter', 'billing', 'Stock', '--kind', 'gateway').code).toBe(0);

    expect(read(root, `${BILLING}/infrastructure/external/remote-stock.gateway.ts`)).toContain('@Gateway(STOCK, { aspects: [ownPolicy(retry({ attempts: 3, backoff: { baseMs: 100 } }), timeout(2000))] })');
    expect(exists(root, `${BILLING}/infrastructure/external/remote-stock.adapter.ts`)).toBe(false);
  });
});

describe('discovery in place of the barrel', () => {
  let root: string;

  beforeAll(() => {
    root = tempDir('discovery');
    scaffoldEverything(root, { http: 'express', validation: 'zod', di: 'tsyringe', tests: 'vitest', orm: 'knex', events: 'outbox', assembly: 'discovery' });
  });

  it('writes no barrel: the composition root discovers each context, and lists the publishers discovery does not load', () => {
    const application = read(root, 'src/platform/application.ts');

    expect(exists(root, `${BILLING}/billing.declarations.ts`)).toBe(false);
    expect(application).toContain("    await discoverContext('billing', new URL('../contexts/billing/', import.meta.url)),");
    expect(application).toContain("const PUBLISHERS: DeclaredSource = [\n  // ddd-ts-kit:publishers\n  InvoiceIssuedPublisher,\n  InvoiceIssuedV2Publisher,\n  // /ddd-ts-kit:publishers\n];");
    expect(application).toContain("    contextModule('publishers', PUBLISHERS),");
    expect(read(root, 'src/apps/shipping/main.ts')).toContain("{ modules: [await discoverContext('shipping', new URL('../../contexts/shipping/', import.meta.url))], routes: [shippingRoutes] },");
  });

  it('discovers the context in the specs too', () => {
    expect(read(root, `${BILLING}/test/unit/issue-invoice.handler.spec.ts`)).toContain("modules: [platformTestModule, await discoverContext('billing', new URL('../../', import.meta.url)), holders],");
    expect(read(root, 'test/architecture/extractable.spec.ts')).toContain("['billing', await discoverContext('billing', new URL('../../src/contexts/billing/', import.meta.url))],");
  });

  it('passes the checker', () => {
    expect((cli(root, 'check', '--json').json() as { violations: unknown[] }).violations).toEqual([]);
    expect(cli(root, 'docs', '--check').code).toBe(0);
  });

  it('is refused behind a broker of the kit, where each context listens through a subscriber built from its barrel', () => {
    const refused = cli(tempDir('discovery'), 'init', '--assembly', 'discovery', '--broker', 'rabbitmq', '--json');

    expect(refused.code).toBe(2);
    expect(failure(refused).message).toBe('--assembly discovery cannot be combined with --broker rabbitmq.');
  });
});
