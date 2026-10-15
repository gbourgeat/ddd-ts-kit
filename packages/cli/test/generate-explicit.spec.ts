import { beforeAll, describe, expect, it } from 'vitest';
import { scan } from '../src/check/scan/scan.js';
import { cli, EXPLICIT_STACK, read, scaffoldEverything, tempDir, walk, type CliResult } from './helpers.js';
import { report } from './reports.js';

const BILLING = 'src/contexts/billing';
const SHIPPING = 'src/contexts/shipping';

let root: string;
let results: CliResult[];

beforeAll(() => {
  root = tempDir('generated');
  results = scaffoldEverything(root, EXPLICIT_STACK, ['--routes', 'functions']);
});

describe('generated code, in the explicit style', () => {
  it('carries no comment but the TODO(domain) and TODO(platform) ones and the marker regions', () => {
    const sources = walk(root, 'src/contexts').filter((file) => file.endsWith('.ts'));

    expect(sources.length).toBeGreaterThan(40);

    for (const file of sources) {
      const scanned = scan(read(root, file));

      expect(scanned.blockComments, file).toEqual([]);

      for (const comment of scanned.comments) {
        expect(comment.text, `${file}:${comment.line}`).toMatch(
          /^(TODO\((?:domain|platform)\): |\/?ddd-ts-kit:[\w-]+$)/,
        );
      }
    }
  });

  it('names no token: no token helper, no token file, no upper-case injection constant, no decorator', () => {
    const sources = walk(root, 'src/contexts').filter((file) => file.endsWith('.ts'));

    expect(sources.filter((file) => /\.ports\.ts$|\/tokens\.ts$/.test(file))).toEqual([]);

    for (const file of sources) {
      const text = read(root, file);

      expect(text, file).not.toMatch(/\btoken[<(]/);
      expect(text, file).not.toMatch(/\[[^\]\n]*\b[A-Z][A-Z0-9]*_[A-Z0-9_]+\b[^\]\n]*\]\)/);
      expect(text, file).not.toContain('@ddd-ts-kit/kernel/declarations');
      expect(text, file).not.toMatch(/#[a-z]\w*\(|this\.#/);
    }
  });

  it('says precisely where business knowledge is expected', () => {
    const todos = results.flatMap((result) => report(result).todos);

    expect(todos.length).toBeGreaterThan(40);

    for (const todo of todos) {
      expect(todo.text.length, `${todo.file}:${todo.line}`).toBeGreaterThan(40);
    }
  });

  it('gives every handler spec one real test through the bus, the refusal of an actor without the permission, and it.todo entries naming behaviours', () => {
    for (const spec of [
      'issue-invoice.handler.spec.ts',
      'cancel-invoice.handler.spec.ts',
      'search-invoices.handler.spec.ts',
    ]) {
      const text = read(root, `${BILLING}/test/unit/${spec}`);

      expect(text.match(/^\s*it\('/gm)?.length, spec).toBe(2);
      expect(text, spec).toContain("rejects.toMatchObject({ code: 'FORBIDDEN' })");
      expect(text, spec).toContain('new RoleBasedAuthorizer({\n    roles: { holder: [billingPermissions[');
      expect(text.match(/^\s*it\.todo\('/gm)?.length, spec).toBeGreaterThanOrEqual(2);
      expect(text, spec).toContain('modules: [platformTestModule, billingModule, holders]');
      expect(text, spec).toMatch(/application\.(commandBus|queryBus)\.execute\(/);
    }

    expect(read(root, `${BILLING}/test/unit/issue-invoice.handler.spec.ts`)).toContain(
      'fakes: [fake(InvoiceRepository, invoiceRepository)],',
    );
  });

  it('is idempotent: generating again changes nothing', () => {
    const before = walk(root).map((file) => [file, read(root, file)]);
    const again = report(cli(root, 'generate', 'integration-event', 'billing', 'Invoice', 'Issued', '--json'));

    cli(root, 'generate', 'route', 'billing', 'IssueInvoice', '--method', 'POST', '--path', '/invoices');
    cli(root, 'generate', 'repository', 'billing', 'Invoice');
    cli(root, 'generate', 'context', 'shipping', '--classification', 'supporting');

    expect(again.created).toEqual([]);
    expect(again.updated).toEqual([]);
    expect(walk(root).map((file) => [file, read(root, file)])).toEqual(before);
  });
});

describe('the module file of an explicit context', () => {
  it('binds each port to its adapter and each message to its handler, the lists naming port classes', () => {
    const module = read(root, `${BILLING}/billing.module.ts`);

    expect(module).toContain(
      "builder\n      .bind(InvoiceRepository)\n      .toClass(DrizzleInvoiceRepository, [Database, ExecutionScope, Clock])\n      .as('repository');",
    );

    expect(module).toContain(
      "builder\n      .command(IssueInvoiceCommand)\n      .requires(billingPermissions['invoice.issue'])\n      .handledBy(IssueInvoiceHandler, [InvoiceRepository, IdGenerator, Clock]);",
    );

    expect(module).toContain(
      "builder\n      .command(CancelInvoiceCommand)\n      .requires(billingPermissions['invoice.cancel'])\n      .handledBy(CancelInvoiceHandler, [Access]);",
    );

    expect(module).toContain(
      "builder.bind(SearchInvoicesReader).toClass(InMemorySearchInvoicesReader).as('repository');",
    );

    expect(module).toContain(
      "builder\n      .query(SearchInvoicesQuery)\n      .requires(billingPermissions['invoice.search'])\n      .handledBy(SearchInvoicesHandler, [SearchInvoicesReader, Access]);",
    );

    expect(module).toContain("import { Database } from '@/platform/database/database';");
    expect(module).toContain('export const billingModule = defineContextModule({');
    expect(module.match(/from '@ddd-ts-kit\/di';/g)).toHaveLength(1);
  });

  it('binds a reaction to a domain event under itself and subscribes it when the module starts', () => {
    const module = read(root, `${BILLING}/billing.module.ts`);

    expect(module).toContain(
      "builder\n      .bind(InvoiceIssuedPublisher)\n      .toClass(InvoiceIssuedPublisher, [IntegrationEventPublisher, IdGenerator])\n      .as('domain-event-handler');",
    );

    expect(module).toContain(
      'resolve(DomainEventDispatcher).on(InvoiceIssued.eventName, async (event) => {\n      if (event instanceof InvoiceIssued) {\n        await resolve(InvoiceIssuedV2Publisher).handle(event);\n      }\n    });',
    );

    expect(module).toContain(
      'if (event instanceof InvoiceIssued) {\n        await resolve(InvoiceIssuedEventHandler).handle(event);\n      }\n    });',
    );
  });

  it('subscribes a reaction generated with --phase after-commit in that phase', () => {
    const module = read(root, `${BILLING}/billing.module.ts`);

    expect(module).toContain(
      "resolve(DomainEventDispatcher).on(\n      InvoiceMarkedAsPaid.eventName,\n      async (event) => {\n        if (event instanceof InvoiceMarkedAsPaid) {\n          await resolve(InvoiceMarkedAsPaidEventHandler).handle(event);\n        }\n      },\n      { phase: 'after-commit' },\n    );",
    );
  });

  it('lists the routes of the context in one function of the two buses, next to the routes', () => {
    const routes = read(root, `${BILLING}/presentation/http/billing.routes.ts`);

    expect(routes).toContain(
      'export function billingRoutes(commands: CommandBus, queries: QueryBus): readonly Route[] {',
    );

    expect(routes).toContain(
      'issueInvoiceRoute(commands),\n    cancelInvoiceRoute(commands),\n    searchInvoicesRoute(queries),',
    );

    expect(read(root, 'src/platform/compose-application.ts')).toContain(
      '    billingRoutes,\n    shippingRoutes,\n    orderFulfilmentRoutes,',
    );
  });

  it('types the integration event handler with the newest declaration of the upstream and subscribes it idempotently, under its consumer name', () => {
    const consumer = read(
      root,
      `${SHIPPING}/application/integration/handlers/billing-invoice-issued.integration-handler.ts`,
    );

    const module = read(root, `${SHIPPING}/shipping.module.ts`);

    expect(consumer).toContain(
      "import { invoiceIssuedV2, type InvoiceIssuedV2 } from '@/contexts/billing/published-language/index';",
    );

    expect(consumer).toContain('static readonly eventType = invoiceIssuedV2.type;');

    expect(consumer).toContain('constructor(private readonly commands: CommandBus) {}');

    expect(module).toContain(
      "builder\n      .on(billingInvoiceIssuedDefinition, { consumer: 'shipping.billing-invoice-issued' })\n      .handledBy(BillingInvoiceIssuedIntegrationHandler, [CommandBus]);",
    );

    expect(module).toContain(
      "builder\n      .bind(BillingInvoiceCancelledIntegrationHandler)\n      .toClass(BillingInvoiceCancelledIntegrationHandler, [CommandBus])\n      .as('consumer');",
    );

    expect(module).toMatch(
      /resolve\(EventSubscribers\)\s+\.forContext\('shipping'\)\s+\.subscribe\(\s+BillingInvoiceCancelledIntegrationHandler\.eventType,\s+idempotent\(\s+'shipping\.billing-invoice-cancelled',\s+resolve\(ProcessedEventStore\)/,
    );
  });
});

describe('the files of an explicit context', () => {
  it('gives the repository its port as an abstract class, its ORM adapter, mapper, table, fake and one contract suite for both', () => {
    const persistence = `${BILLING}/infrastructure/persistence`;
    const contract = read(root, `${BILLING}/test/integration/invoice.repository.contract.spec.ts`);

    expect(read(root, `${BILLING}/domain/repositories/invoice.repository.ts`)).toContain(
      'export abstract class InvoiceRepository extends Repository<Invoice> {',
    );

    expect(read(root, `${persistence}/billing.schema.ts`)).toContain(
      "export const invoices = billingSchema.table('invoices', {",
    );

    expect(read(root, `${persistence}/invoice.mapper.ts`)).toContain('export const InvoiceMapper = {');

    expect(read(root, `${persistence}/drizzle-invoice.repository.ts`)).toContain(
      'export class DrizzleInvoiceRepository implements InvoiceRepository {\n  constructor(\n    private readonly database: Database,',
    );

    expect(read(root, `${persistence}/drizzle-invoice.repository.ts`)).toContain(
      "import type { Database } from '@/platform/database/database';",
    );

    expect(read(root, 'src/platform/database/schema.ts')).toContain(
      "export * from '@/contexts/billing/infrastructure/persistence/billing.schema';",
    );

    expect(read(root, `${BILLING}/test/fakes/invoice.repository.fake.ts`)).toContain(
      'extends InMemoryRepository<Invoice> implements InvoiceRepository',
    );

    expect(contract.match(/repositoryContract<Invoice>\(runner, \{/g)).toHaveLength(2);
    expect(contract).toContain('database = await openTestDatabase();');
  });

  it('splits a query into its message, its result and its handler, with a read port that is an abstract class', () => {
    const folder = `${BILLING}/application/queries/search-invoices`;

    expect(walk(root, folder)).toEqual([
      `${folder}/search-invoices.handler.ts`,
      `${folder}/search-invoices.query.ts`,
      `${folder}/search-invoices.result.ts`,
    ]);

    expect(read(root, `${folder}/search-invoices.result.ts`)).toContain(
      'export type SearchInvoicesResult = Page<SearchInvoicesItem>;',
    );

    expect(read(root, `${folder}/search-invoices.query.ts`).match(/^export /gm)).toHaveLength(1);

    expect(read(root, `${BILLING}/application/ports/search-invoices-reader.port.ts`)).toContain(
      'export abstract class SearchInvoicesReader {\n  abstract search(scope: AccessScope, page: PageRequest<SearchInvoicesSort>): Promise<SearchInvoicesResult>;\n}',
    );

    expect(read(root, `${BILLING}/infrastructure/persistence/in-memory-search-invoices.reader.ts`)).toContain(
      'export class InMemorySearchInvoicesReader implements SearchInvoicesReader {\n  protected readonly invoices: readonly SearchInvoicesItem[] = [];',
    );

    expect(read(root, `${BILLING}/test/fakes/search-invoices-reader.fake.ts`)).toContain(
      'export class FakeSearchInvoicesReader extends InMemorySearchInvoicesReader {',
    );
  });

  it('declares integration events in the published language and lists them', () => {
    expect(read(root, `${BILLING}/published-language/index.ts`)).toBe(
      "export * from '@/contexts/billing/published-language/invoice-issued.v1.integration-event';\nexport * from '@/contexts/billing/published-language/invoice-issued.v2.integration-event';\nexport * from '@/contexts/billing/published-language/invoice-status.contract';\n",
    );

    expect(read(root, `${BILLING}/published-language/invoice-issued.v2.integration-event.ts`)).toContain(
      "export const invoiceIssuedV2 = defineIntegrationEvent({\n  type: 'billing.invoice.issued',\n  version: 2,",
    );

    expect(read(root, `${BILLING}/CONTEXT.md`)).toContain(
      '- `billing.invoice.issued` (version 1)\n- `billing.invoice.issued` (version 2)',
    );
  });

  it('writes an end-to-end spec that drives the route of the use case', () => {
    const spec = read(root, 'test/e2e/issue-invoice.e2e.spec.ts');

    expect(spec).toContain("const response = await application.client.post('/invoices', {});");
    expect(spec).toContain('expectStatus(response, 201);');
    expect(spec).toContain('reportSeedOnFailure({ beforeEach, onTestFailed });');
    expect(spec).toContain("from '$test/e2e/support/start-application';");

    expect(read(root, 'test/e2e/track-purchase-order.e2e.spec.ts')).toContain(
      "application.client.get('/purchase-orders/purchase-order-id-1/tracking');",
    );
  });
});

describe('an explicit project, as `list` maps it', () => {
  const JOBS = [
    { name: 'billing.cancel-stale-invoices', schedule: 'every 15m', command: 'CancelInvoice' },
    { name: 'billing.issue-invoices-monthly', schedule: 'cron 0 6 1 * * (Europe/Paris)', command: 'IssueInvoice' },
  ];

  it('maps the project for `list`, with the glossary size, the builders and the end-to-end specs', () => {
    const map = cli(root, 'list', '--json').json() as { contexts: Record<string, unknown>[]; e2e: string[] };
    const text = cli(root, 'list').stdout;

    expect(map.contexts).toEqual([
      expect.objectContaining({
        name: 'billing',
        classification: 'core',
        glossary: 17,
        upstreams: [],
        aggregates: ['Invoice'],
        commands: ['CancelInvoice', 'IssueInvoice'],
        queries: ['SearchInvoices'],
        domainEvents: ['InvoiceIssued', 'InvoiceMarkedAsPaid'],
        publishedEvents: ['billing.invoice.issued@v1', 'billing.invoice.issued@v2'],
        builders: ['Invoice'],
        jobs: JOBS,
      }),
      expect.objectContaining({
        name: 'order-fulfilment',
        classification: 'generic',
        glossary: 3,
        aggregates: ['PurchaseOrder'],
        commands: ['PlacePurchaseOrder'],
        builders: ['PurchaseOrder'],
      }),
      expect.objectContaining({
        name: 'shipping',
        classification: 'supporting',
        glossary: 1,
        upstreams: [{ context: 'billing', relationship: 'customer-supplier' }],
      }),
    ]);

    expect(map.e2e).toEqual(['issue-invoice', 'track-purchase-order']);
    expect(text).toContain('billing [core]\n  glossary: 17 terms\n  upstreams: none\n  aggregates: Invoice');

    expect(text).toContain(
      '  scheduled jobs: billing.cancel-stale-invoices (every 15m, sends CancelInvoice), billing.issue-invoices-monthly (cron 0 6 1 * * (Europe/Paris), sends IssueInvoice)\n  builders: Invoice',
    );

    expect(text).toContain('end-to-end specs: issue-invoice, track-purchase-order');
  });
});
