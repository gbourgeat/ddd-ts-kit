import { beforeAll, describe, expect, it } from 'vitest';
import { cli, exists, read, scaffoldEverything, tempDir, walk, write } from './helpers.js';
import { failure } from './reports.js';

const BILLING = 'src/contexts/billing';
const SHIPPING = 'src/contexts/shipping';

let root: string;

beforeAll(() => {
  root = tempDir('declared');
  scaffoldEverything(root);
});

/** The default way a project is written: each class declares what it is, and no file lists the bindings of a context. */
describe('a context generated in the declared style', () => {
  it('has no module file, no token file: the list of its routes and one generated barrel are all that assembles it', () => {
    const billing = walk(root, BILLING).map((file) => file.replace(`${BILLING}/`, ''));

    expect(billing).not.toContain('billing.module.ts');
    expect(billing.filter((file) => file.endsWith('.ports.ts'))).toEqual([]);
    expect(billing).toEqual(expect.arrayContaining(['billing.declarations.ts', 'presentation/http/billing.routes.ts']));

    expect(read(root, `${BILLING}/presentation/http/billing.routes.ts`)).toContain(
      'issueInvoiceRoute(commands),\n    cancelInvoiceRoute(commands),\n    searchInvoicesRoute(queries),',
    );
  });

  it('exports every role file from the barrel, sorted by path, and nothing else', () => {
    expect(read(root, `${BILLING}/billing.declarations.ts`).trimEnd().split('\n')).toEqual([
      "export * from '@/contexts/billing/application/authorization/only-issuer-cancels.policy.js';",
      "export * from '@/contexts/billing/application/commands/cancel-invoice/cancel-invoice.command.js';",
      "export * from '@/contexts/billing/application/commands/cancel-invoice/cancel-invoice.handler.js';",
      "export * from '@/contexts/billing/application/commands/issue-invoice/issue-invoice.command.js';",
      "export * from '@/contexts/billing/application/commands/issue-invoice/issue-invoice.handler.js';",
      "export * from '@/contexts/billing/application/event-handlers/invoice-issued.event-handler.js';",
      "export * from '@/contexts/billing/application/event-handlers/invoice-marked-as-paid.event-handler.js';",
      "export * from '@/contexts/billing/application/integration/publishers/invoice-issued-v2.publisher.js';",
      "export * from '@/contexts/billing/application/integration/publishers/invoice-issued.publisher.js';",
      "export * from '@/contexts/billing/application/queries/search-invoices/search-invoices.handler.js';",
      "export * from '@/contexts/billing/application/queries/search-invoices/search-invoices.query.js';",
      "export * from '@/contexts/billing/application/scheduling/cancel-stale-invoices.job.js';",
      "export * from '@/contexts/billing/application/scheduling/issue-invoices-monthly.job.js';",
      "export * from '@/contexts/billing/infrastructure/external/remote-payment-gateway.adapter.js';",
      "export * from '@/contexts/billing/infrastructure/external/remote-tax-rates.adapter.js';",
      "export * from '@/contexts/billing/infrastructure/persistence/drizzle-invoice.repository.js';",
      "export * from '@/contexts/billing/infrastructure/persistence/in-memory-search-invoices-reader.repository.js';",
    ]);
  });

  it('says who may send a message on the message, and what handles it on the handler, the list naming port classes', () => {
    const command = read(root, `${BILLING}/application/commands/issue-invoice/issue-invoice.command.ts`);
    const handler = read(root, `${BILLING}/application/commands/issue-invoice/issue-invoice.handler.ts`);
    const list = read(root, `${BILLING}/application/queries/search-invoices/search-invoices.handler.ts`);

    expect(command).toContain(
      "@Requires(billingPermissions['invoice.issue'])\nexport class IssueInvoiceCommand extends AuthorizedCommand<string> {",
    );

    expect(handler).toContain(
      '@CommandHandler(IssueInvoiceCommand, [InvoiceRepository, IdGenerator, Clock])\nexport class IssueInvoiceHandler implements CommandHandler<IssueInvoiceCommand> {',
    );

    expect(handler).toContain("import { Clock, IdGenerator } from '@ddd-ts-kit/kernel';");

    expect(handler).toContain(
      "import { InvoiceRepository } from '@/contexts/billing/domain/repositories/invoice.repository.js';",
    );

    expect(read(root, `${BILLING}/application/commands/cancel-invoice/cancel-invoice.handler.ts`)).toContain(
      '@CommandHandler(CancelInvoiceCommand)\n',
    );

    expect(
      read(
        root,
        'src/contexts/order-fulfilment/application/queries/track-purchase-order/track-purchase-order.query.ts',
      ),
    ).toContain('@Public()\nexport class TrackPurchaseOrderQuery extends Query<TrackPurchaseOrderResult> {');

    expect(list).toContain('@QueryHandler(SearchInvoicesQuery, [SearchInvoicesReader, Access])');
    expect(list).toContain("import { Access } from '@ddd-ts-kit/auth';");
  });

  it('declares a port as an abstract class, which is also what a list and a binding name', () => {
    expect(read(root, `${BILLING}/domain/repositories/invoice.repository.ts`)).toContain(
      "import { Repository } from '@ddd-ts-kit/kernel';",
    );

    expect(read(root, `${BILLING}/domain/repositories/invoice.repository.ts`)).toContain(
      'export abstract class InvoiceRepository extends Repository<Invoice> {',
    );

    expect(read(root, `${BILLING}/application/ports/payment-gateway.port.ts`)).toContain(
      'export abstract class PaymentGateway {',
    );

    expect(read(root, `${BILLING}/application/ports/search-invoices-reader.port.ts`)).toContain(
      'export abstract class SearchInvoicesReader {\n  abstract search(',
    );

    expect(read(root, `${BILLING}/test/fakes/payment-gateway.fake.ts`)).toContain(
      'export class FakePaymentGateway implements PaymentGateway {',
    );
  });
});

describe('a context generated in the declared style, towards the outside', () => {
  it('binds each adapter by its own declaration: repository, read port, outside system with its policy', () => {
    const repository = read(root, `${BILLING}/infrastructure/persistence/drizzle-invoice.repository.ts`);
    const decorated = read(root, `${BILLING}/infrastructure/external/remote-tax-rates.adapter.ts`);

    expect(repository).toContain(
      '@Repository(InvoiceRepository, [Database, ExecutionScope, Clock])\nexport class DrizzleInvoiceRepository implements InvoiceRepository {',
    );

    expect(repository).toContain("import { Database } from '@/platform/database/database.js';");
    expect(repository).toContain('  private insert(state: VersionedInvoice) {');

    expect(
      read(root, `${BILLING}/infrastructure/persistence/in-memory-search-invoices-reader.repository.ts`),
    ).toContain(
      '@Repository(SearchInvoicesReader)\nexport class InMemorySearchInvoicesReader implements SearchInvoicesReader {\n  protected readonly items: readonly SearchInvoicesItem[] = [];',
    );

    expect(read(root, `${BILLING}/infrastructure/external/remote-payment-gateway.adapter.ts`)).toContain(
      "@Adapter(PaymentGateway, {\n  kind: 'external',\n  aspects: [ownPolicy(retry({ attempts: 3, backoff: { baseMs: 100 } }), timeout(2000))],\n})\nexport class RemotePaymentGateway implements PaymentGateway {",
    );

    expect(decorated).toContain("@Adapter(TaxRates, { kind: 'external', aspects: [ownPolicy()] })");

    expect(decorated).toContain(
      '  @Retry({ attempts: 3, backoff: { baseMs: 100 } })\n  @Timeout(2000, { signal: true })\n  async send(',
    );

    expect(decorated).toContain("import { ownPolicy } from '@/platform/resilience/own-policy.js';");
  });

  it('declares reactions: to a domain event, to publish it, to an integration event of an upstream, and a policy as a class', () => {
    expect(read(root, `${BILLING}/application/event-handlers/invoice-issued.event-handler.ts`)).toContain(
      "@DomainEventHandler(InvoiceIssued, { name: 'billing.invoice.issued' })\nexport class InvoiceIssuedEventHandler implements DomainEventHandler<InvoiceIssued> {",
    );

    expect(read(root, `${BILLING}/application/event-handlers/invoice-marked-as-paid.event-handler.ts`)).toContain(
      "@DomainEventHandler(InvoiceMarkedAsPaid, { name: 'billing.invoice.marked-as-paid', phase: 'after-commit' })\nexport class InvoiceMarkedAsPaidEventHandler implements DomainEventHandler<InvoiceMarkedAsPaid> {",
    );

    expect(read(root, `${BILLING}/application/integration/publishers/invoice-issued.publisher.ts`)).toContain(
      "@DomainEventHandler(InvoiceIssued, { name: 'billing.invoice.issued' }, [IntegrationEventPublisher, IdGenerator])\nexport class InvoiceIssuedPublisher implements DomainEventHandler<InvoiceIssued> {",
    );

    expect(
      read(root, `${SHIPPING}/application/integration/handlers/billing-invoice-issued.integration-handler.ts`),
    ).toContain(
      "@IntegrationEventHandler(invoiceIssuedV2, { consumer: 'shipping.billing-invoice-issued' }, [CommandBus])\nexport class BillingInvoiceIssuedIntegrationHandler {",
    );

    expect(read(root, `${BILLING}/application/authorization/only-issuer-cancels.policy.ts`)).toContain(
      "@Policy(billingPermissions['invoice.cancel'], { name: 'billing.only-issuer-cancels' })\nexport class OnlyIssuerCancelsPolicy {",
    );

    expect(read(root, 'src/platform/auth/access-policies.ts')).not.toContain('OnlyIssuerCancels');
  });

  it('keeps in the platform modules the one thing a decorator cannot say: the value a gateway is given, for the application and for the specs', () => {
    const gateway = read(root, `${SHIPPING}/infrastructure/external/in-process-invoice-status.gateway.ts`);

    expect(gateway).toContain(
      '@Gateway(InvoiceStatusGateway, [InvoiceStatusContract])\nexport class InProcessInvoiceStatusGateway implements InvoiceStatusGateway {',
    );

    expect(gateway).toContain(
      "import { InvoiceStatusContract } from '@/contexts/billing/published-language/index.js';",
    );

    expect(read(root, `${BILLING}/published-language/invoice-status.contract.ts`)).toContain(
      'export abstract class InvoiceStatusContract {',
    );

    expect(read(root, 'src/platform/platform.module.ts')).toContain(
      '      // ddd-ts-kit:bindings\n      builder.bind(InvoiceStatusContract).toValue({});\n      // /ddd-ts-kit:bindings',
    );

    expect(read(root, 'src/platform/platform-test.module.ts')).toContain(
      '    // ddd-ts-kit:test-bindings\n    builder.bind(InvoiceStatusContract).toValue({});\n    // /ddd-ts-kit:test-bindings',
    );
  });
});

describe('a declared context and what hosts it', () => {
  it('is assembled in one line of the composition root, of the entry point of a context run alone, and of the proof that it wires alone', () => {
    const composition = read(root, 'src/platform/compose-application.ts');

    expect(composition).toContain("import * as billingDeclarations from '@/contexts/billing/billing.declarations.js';");

    expect(composition).toContain(
      "    contextModule('billing', billingDeclarations),\n    contextModule('shipping', shippingDeclarations),\n    contextModule('order-fulfilment', orderFulfilmentDeclarations),",
    );

    expect(composition).toContain('    billingRoutes,\n    shippingRoutes,\n    orderFulfilmentRoutes,');

    expect(read(root, 'src/apps/shipping/main.ts')).toContain(
      "{ modules: [contextModule('shipping', shippingDeclarations)], routes: [shippingRoutes] },",
    );

    expect(read(root, 'test/architecture/extractable.spec.ts')).toContain(
      "['billing', contextModule('billing', billingDeclarations)],",
    );
  });

  it('tests a handler on the platform of the specs, the declarations of its context, an authorization module and fakes', () => {
    const spec = read(root, `${BILLING}/test/unit/issue-invoice.handler.spec.ts`);
    const open = read(root, 'src/contexts/order-fulfilment/test/unit/track-purchase-order.handler.spec.ts');

    expect(spec).toContain("import * as billingDeclarations from '@/contexts/billing/billing.declarations.js';");
    expect(spec).toContain("import { platformTestModule } from '@/platform/platform-test.module.js';");

    expect(spec).toContain(
      "  const context = contextModule('billing', billingDeclarations);\n\n  const invoiceRepository = new FakeInvoiceRepository();\n\n  const application = createTestApplication({\n    modules: [platformTestModule, context, holders],\n    fakes: [fake(InvoiceRepository, invoiceRepository)],\n    idPrefix: 'invoice',\n  });",
    );

    expect(open).toContain(
      'const authorization = authorizationModule({ authorizer: new RoleBasedAuthorizer({ roles: {} }) });',
    );

    expect(open).toContain(
      "  const context = contextModule('order-fulfilment', orderFulfilmentDeclarations);\n\n  return createTestApplication({\n    modules: [platformTestModule, context, authorization],",
    );
  });

  it('passes the checker and has its documentation current', () => {
    const result = cli(root, 'check', '--json').json() as { violations: unknown[]; ok: boolean };

    expect(result.violations).toEqual([]);
    expect(result.ok).toBe(true);
    expect(cli(root, 'docs', '--check').code).toBe(0);
  });

  it('refuses a handler of an event its upstream does not declare, and a second adapter for a port', () => {
    const undeclared = cli(
      root,
      'generate',
      'integration-handler',
      'shipping',
      'billing',
      'billing.invoice.cancelled',
      '--json',
    );

    const second = cli(root, 'generate', 'adapter', 'shipping', 'InvoiceStatusGateway', '--kind', 'gateway', '--json');

    expect(undeclared.code).toBe(2);

    expect(failure(undeclared).message).toBe(
      'billing declares no billing.invoice.cancelled in its published language.',
    );

    expect(failure(undeclared).fix).toContain('ddd-ts-kit generate integration-event billing Invoice Cancelled');
    expect(second.code).toBe(2);

    expect(failure(second).message).toBe(
      'InvoiceStatusGateway is already bound by infrastructure/external/in-process-invoice-status.gateway.ts.',
    );
  });

  it('accepts the former name of the integration-handler kind', () => {
    expect(cli(root, 'generate', 'consumer', 'shipping', 'billing', 'billing.invoice.issued', '--dry-run').code).toBe(
      0,
    );
  });

  it('rewrites the barrel on every generate and on docs, and reports one that a hand-added role file left behind', () => {
    const added = `${SHIPPING}/infrastructure/external/remote-carrier.adapter.ts`;

    write(
      root,
      added,
      "import { Adapter } from '@ddd-ts-kit/kernel/declarations';\nimport { InvoiceStatusContract } from '@/contexts/billing/published-language/index.js';\n\n@Adapter(InvoiceStatusContract)\nexport class RemoteCarrier implements InvoiceStatusContract {}\n",
    );

    const stale = cli(root, 'docs', '--check');

    expect(stale.code).toBe(1);
    expect(stale.stdout).toContain(`stale  ${SHIPPING}/shipping.declarations.ts`);
    expect(cli(root, 'check', '--rule', 'declarations/barrel-current').code).toBe(1);

    expect(cli(root, 'docs').code).toBe(0);

    expect(read(root, `${SHIPPING}/shipping.declarations.ts`)).toContain(
      "export * from '@/contexts/shipping/infrastructure/external/remote-carrier.adapter.js';",
    );

    expect(cli(root, 'check', '--rule', 'declarations/barrel-current').code).toBe(0);
  });
});

describe('a declared adapter towards another context', () => {
  it('is a gateway: its file and its decorator say so', () => {
    const project = tempDir('declared');

    cli(project, 'init', '--context', 'billing:core');
    cli(project, 'generate', 'port', 'billing', 'Stock');

    expect(cli(project, 'generate', 'adapter', 'billing', 'Stock', '--kind', 'gateway').code).toBe(0);

    expect(read(project, `${BILLING}/infrastructure/external/remote-stock.gateway.ts`)).toContain(
      '@Gateway(Stock, {\n  aspects: [ownPolicy(retry({ attempts: 3, backoff: { baseMs: 100 } }), timeout(2000))],\n})',
    );

    expect(exists(project, `${BILLING}/infrastructure/external/remote-stock.adapter.ts`)).toBe(false);
  });
});
