import { beforeAll, describe, expect, it } from 'vitest';
import { cli, read, scaffoldEverything, tempDir, walk } from './helpers';
import { failure } from './reports';

const BILLING = 'src/contexts/billing';
const SHIPPING = 'src/contexts/shipping';

let root: string;

beforeAll(() => {
  root = tempDir('declared');
  scaffoldEverything(root);
});

/** The default way a project is written: each class declares what it is, and no file lists the bindings of a context. */
describe('a context generated in the declared style', () => {
  it('has no module file, no token file and no list of routes: generated declarations are all that assembles it', () => {
    const billing = walk(root, BILLING).map((file) => file.replace(`${BILLING}/`, ''));

    expect(billing).not.toContain('billing.module.ts');
    expect(billing).not.toContain('presentation/http/billing.routes.ts');
    expect(billing.filter((file) => file.endsWith('.ports.ts'))).toEqual([]);

    expect(billing).toEqual(
      expect.arrayContaining([
        'billing.declarations.ts',
        'application/application.declarations.ts',
        'infrastructure/infrastructure.declarations.ts',
        'presentation/presentation.declarations.ts',
        'presentation/http/invoices.routes.ts',
        'presentation/http/invoices/issue-invoice/issue-invoice.controller.ts',
      ]),
    );
  });

  it('says who may send a message on the message, and what handles it on the handler, whose constructor states its ports', () => {
    const command = read(root, `${BILLING}/application/commands/issue-invoice/issue-invoice.command.ts`);
    const handler = read(root, `${BILLING}/application/commands/issue-invoice/issue-invoice.handler.ts`);
    const list = read(root, `${BILLING}/application/queries/search-invoices/search-invoices.handler.ts`);

    expect(command).toContain(
      "@Requires(billingPermissions['invoice.issue'])\nexport class IssueInvoiceCommand extends AuthorizedCommand<string> {",
    );

    expect(handler).toContain(
      '@CommandHandler(IssueInvoiceCommand)\nexport class IssueInvoiceHandler implements CommandHandler<IssueInvoiceCommand> {\n  constructor(\n    private readonly invoiceRepository: InvoiceRepository,\n    private readonly ids: IdGenerator,\n    private readonly clock: Clock,\n  ) {}',
    );

    expect(handler).toContain("import type { Clock, IdGenerator } from '@ddd-ts-kit/kernel';");

    expect(handler).toContain(
      "import type { InvoiceRepository } from '@/contexts/billing/domain/repositories/invoice.repository';",
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

    expect(list).toContain('@QueryHandler(SearchInvoicesQuery)\n');
    expect(list).toContain("import type { Access } from '@ddd-ts-kit/auth';");
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
      '@Repository(InvoiceRepository)\nexport class DrizzleInvoiceRepository implements InvoiceRepository {\n  constructor(\n    private readonly database: Database,',
    );

    expect(repository).toContain("import type { Database } from '@/platform/database/database';");
    expect(repository).toContain('  private insert(state: VersionedInvoice) {');

    expect(
      read(root, `${BILLING}/infrastructure/persistence/in-memory-search-invoices-reader.repository.ts`),
    ).toContain(
      '@Repository(SearchInvoicesReader)\nexport class InMemorySearchInvoicesReader implements SearchInvoicesReader {\n  protected readonly invoices: readonly SearchInvoicesItem[] = [];',
    );

    expect(read(root, `${BILLING}/infrastructure/external/remote-payment-gateway.adapter.ts`)).toContain(
      "@Adapter(PaymentGateway, {\n  kind: 'external',\n  aspects: [ownPolicy(retry({ attempts: 3, backoff: { baseMs: 100 } }), timeout(2000))],\n})\nexport class RemotePaymentGateway implements PaymentGateway {",
    );

    expect(decorated).toContain("@Adapter(TaxRates, { kind: 'external', aspects: [ownPolicy()] })");

    expect(decorated).toContain(
      '  @Retry({ attempts: 3, backoff: { baseMs: 100 } })\n  @Timeout(2000, { signal: true })\n  async send(',
    );

    expect(decorated).toContain("import { ownPolicy } from '@/platform/resilience/own-policy';");
  });

  it('declares reactions: to a domain event, to publish it, to an integration event of an upstream, and a policy as a class', () => {
    expect(read(root, `${BILLING}/application/event-handlers/invoice-issued.event-handler.ts`)).toContain(
      '@DomainEventHandler(InvoiceIssued)\nexport class InvoiceIssuedEventHandler implements DomainEventHandler<InvoiceIssued> {',
    );

    expect(read(root, `${BILLING}/application/event-handlers/invoice-marked-as-paid.event-handler.ts`)).toContain(
      "@DomainEventHandler(InvoiceMarkedAsPaid, { phase: 'after-commit' })\nexport class InvoiceMarkedAsPaidEventHandler implements DomainEventHandler<InvoiceMarkedAsPaid> {",
    );

    expect(read(root, `${BILLING}/application/integration/publishers/invoice-issued.publisher.ts`)).toContain(
      '@DomainEventHandler(InvoiceIssued)\nexport class InvoiceIssuedPublisher implements DomainEventHandler<InvoiceIssued> {\n  constructor(\n    private readonly publisher: IntegrationEventPublisher,',
    );

    expect(
      read(root, `${SHIPPING}/application/integration/handlers/billing-invoice-issued.integration-handler.ts`),
    ).toContain(
      "@IntegrationEventHandler(invoiceIssuedV2, { consumer: 'shipping.billing-invoice-issued' })\nexport class BillingInvoiceIssuedIntegrationHandler {",
    );

    expect(read(root, `${BILLING}/application/authorization/only-issuer-cancels.policy.ts`)).toContain(
      "@Policy(billingPermissions['invoice.cancel'], { name: 'billing.only-issuer-cancels' })\nexport class OnlyIssuerCancelsPolicy {",
    );

    expect(read(root, 'src/platform/auth/authorization/access-policies.ts')).not.toContain('OnlyIssuerCancels');
  });

  it('keeps in the platform modules the one thing a decorator cannot say: the value a gateway is given, for the application and for the specs', () => {
    const gateway = read(root, `${SHIPPING}/infrastructure/external/in-process-invoice-status.gateway.ts`);

    expect(gateway).toContain(
      '@Gateway(InvoiceStatusGateway)\nexport class InProcessInvoiceStatusGateway implements InvoiceStatusGateway {\n  constructor(readonly upstream: InvoiceStatusContract) {}',
    );

    expect(gateway).toContain("import type { InvoiceStatusContract } from '@/contexts/billing/published-language';");

    expect(read(root, `${SHIPPING}/infrastructure/infrastructure.declarations.ts`)).toContain(
      'injected(InProcessInvoiceStatusGateway, [InvoiceStatusContract]);',
    );

    expect(read(root, `${BILLING}/published-language/invoice-status.contract.ts`)).toContain(
      'export abstract class InvoiceStatusContract {',
    );

    expect(read(root, 'src/platform/composition/platform.module.ts')).toContain(
      '      // ddd-ts-kit:bindings\n      builder.bind(InvoiceStatusContract).toValue({});\n      // /ddd-ts-kit:bindings',
    );

    expect(read(root, 'src/platform/composition/platform-test.module.ts')).toContain(
      '    // ddd-ts-kit:test-bindings\n    builder.bind(InvoiceStatusContract).toValue({});\n    // /ddd-ts-kit:test-bindings',
    );
  });
});

describe('a declared context and what hosts it', () => {
  it('is assembled in one line of the composition root, of the entry point of a context run alone, and of the proof that it wires alone', () => {
    const composition = read(root, 'src/platform/composition/compose-application.ts');

    expect(composition).toContain("import * as billingDeclarations from '@/contexts/billing/billing.declarations';");

    expect(composition).toContain(
      "    contextModule('billing', billingDeclarations),\n    contextModule('shipping', shippingDeclarations),\n    contextModule('order-fulfilment', orderFulfilmentDeclarations),",
    );

    expect(composition).not.toContain('billingRoutes');

    expect(composition).toContain(
      "controllerRoutes(container.resolve(DeclaredEdges).of('controller'), { resolve: container.resolve, security }),",
    );

    expect(read(root, 'src/apps/shipping/main.ts')).toContain(
      "{ modules: [contextModule('shipping', shippingDeclarations)] },",
    );

    expect(read(root, 'test/architecture/extractable.spec.ts')).toContain(
      "['billing', contextModule('billing', billingDeclarations)],",
    );
  });

  it('tests a handler on the platform of the specs, the declarations of its context, an authorization module and fakes', () => {
    const spec = read(root, `${BILLING}/test/unit/issue-invoice.handler.spec.ts`);
    const open = read(root, 'src/contexts/order-fulfilment/test/unit/track-purchase-order.handler.spec.ts');

    expect(spec).toContain("import * as billingDeclarations from '@/contexts/billing/billing.declarations';");
    expect(spec).toContain("import { platformTestModule } from '@/platform/composition/platform-test.module';");

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
});
