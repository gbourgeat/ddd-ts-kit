import { beforeAll, describe, expect, it } from 'vitest';
import { scan } from '../src/check/scanner.js';
import { KINDS } from '../src/generate/kinds.js';
import { insertInRegion, parseWiring } from '../src/markers.js';
import { cli, exists, read, scaffoldEverything, tempDir, walk, write, type CliResult } from './helpers.js';

interface Report {
  readonly dryRun: boolean;
  readonly created: string[];
  readonly updated: string[];
  readonly skipped: string[];
  readonly next: string[];
  readonly todos: { file: string; line: number; text: string }[];
  readonly notes: string[];
}

const report = (result: CliResult): Report => result.json() as Report;
const failure = (result: CliResult): { message: string; fix: string } => (result.json() as { error: { message: string; fix: string } }).error;

describe('marker regions', () => {
  const file = ['// ddd-ts-kit:imports', "import a from './a.js';", '// /ddd-ts-kit:imports', 'function wire() {', '  // ddd-ts-kit:registrations', '  // /ddd-ts-kit:registrations', '}'].join('\n');

  it('inserts before the closing marker with its indentation', () => {
    expect(insertInRegion(file, 'registrations', 'const b = 1;\nuse(b);')).toContain('  // ddd-ts-kit:registrations\n  const b = 1;\n  use(b);\n  // /ddd-ts-kit:registrations');
  });

  it('adds an import line once', () => {
    const once = insertInRegion(file, 'imports', "import a from './a.js';\nimport b from './b.js';") ?? '';

    expect(once.match(/import a from/g)).toHaveLength(1);
    expect(insertInRegion(once, 'imports', "import b from './b.js';")).toBe(once);
  });

  it('adds a block once, and keeps two blocks that only share their first line', () => {
    const first = insertInRegion(file, 'registrations', 'on(x, () => {\n  a();\n});') ?? '';
    const second = insertInRegion(first, 'registrations', 'on(x, () => {\n  b();\n});') ?? '';

    expect(insertInRegion(second, 'registrations', 'on(x, () => {\n  a();\n});')).toBe(second);
    expect(second).toContain('a();');
    expect(second).toContain('b();');
  });

  it('answers undefined when the region is gone, and reads Markdown markers', () => {
    expect(insertInRegion(file, 'routes', 'x')).toBeUndefined();
    expect(insertInRegion('<!-- ddd-ts-kit:aggregates -->\n<!-- /ddd-ts-kit:aggregates -->', 'aggregates', '- `Invoice`')).toBe(
      '<!-- ddd-ts-kit:aggregates -->\n- `Invoice`\n<!-- /ddd-ts-kit:aggregates -->',
    );
  });

  it('splits a wiring template into regions', () => {
    const sections = [...parseWiring('@@imports\nimport a;\n@@routes\nroute(),\n')].map(([region, block]) => [region, block.trim()]);

    expect(sections).toEqual([
      ['imports', 'import a;'],
      ['routes', 'route(),'],
    ]);
  });
});

describe('generate', () => {
  let root: string;

  beforeAll(() => {
    root = tempDir('generate');
    expect(cli(root, 'init').code).toBe(0);
    expect(cli(root, 'generate', 'context', 'billing', '--classification', 'core', '--term', 'Invoice=A request for payment', '--term', 'Issue=To make an invoice final').code).toBe(0);
    expect(cli(root, 'generate', 'context', 'shipping', '--classification', 'supporting').code).toBe(0);
  });

  it('writes the production file, its builder and its spec at the canonical paths, and updates CONTEXT.md', () => {
    const result = report(cli(root, 'generate', 'aggregate', 'billing', 'invoice', '--json'));

    expect(result.created).toEqual([
      'src/contexts/billing/domain/aggregates/invoice.aggregate.ts',
      'src/contexts/billing/test/builders/invoice.builder.ts',
      'src/contexts/billing/test/unit/invoice.aggregate.spec.ts',
    ]);
    expect(result.updated).toEqual(expect.arrayContaining(['src/contexts/billing/CONTEXT.md']));
    expect(read(root, 'src/contexts/billing/CONTEXT.md')).toContain('<!-- ddd-ts-kit:aggregates -->\n- `Invoice`\n<!-- /ddd-ts-kit:aggregates -->');
    const aggregate = read(root, 'src/contexts/billing/domain/aggregates/invoice.aggregate.ts');
    expect(aggregate).toContain('private constructor(');
    expect(aggregate).toContain('static create(');
    expect(aggregate).toContain('static rehydrate(');
    expect(read(root, 'src/contexts/billing/test/builders/invoice.builder.ts')).toContain('export class InvoiceBuilder extends Builder<InvoiceIngredients, Invoice>');
    expect(read(root, 'src/contexts/billing/test/unit/invoice.aggregate.spec.ts')).toMatch(/given\(anInvoice\(\)\)\s+\.when\(.+\)\s+\.thenEvents\(\[\]\);/);
  });

  it('refuses a name with a word the glossary does not define, and says how to add the term', () => {
    const refused = cli(root, 'generate', 'aggregate', 'billing', 'CreditNote', '--json');

    expect(refused.code).toBe(2);
    expect(failure(refused).message).toContain('"credit", "note"');
    expect(failure(refused).fix).toContain('use an existing term (Invoice, Issue)');
    expect(failure(refused).fix).toContain('--term "Credit=<what it means for the business>"');
    expect(exists(root, 'src/contexts/billing/domain/aggregates/credit-note.aggregate.ts')).toBe(false);
  });

  it('accepts inflected forms of a term: plural, past participle, -ing', () => {
    expect(cli(root, 'generate', 'domain-event', 'billing', 'Invoice', 'Issued', '--dry-run').code).toBe(0);
    expect(cli(root, 'generate', 'domain-service', 'billing', 'InvoiceIssuing', '--dry-run').code).toBe(0);
    expect(cli(root, 'generate', 'query', 'billing', 'IssuedInvoices', '--public', '--dry-run').code).toBe(0);
  });

  it('adds the terms given with --term to the glossary, then accepts the name', () => {
    const result = report(cli(root, 'generate', 'value-object', 'billing', 'Money', '--term', 'Money=An amount in a currency', '--json'));

    expect(result.created).toContain('src/contexts/billing/domain/value-objects/money.vo.ts');
    expect(read(root, 'src/contexts/billing/CONTEXT.md')).toContain('| Issue | To make an invoice final |  |\n| Money | An amount in a currency |  |');
    expect(failure(cli(root, 'generate', 'entity', 'billing', 'Line', '--term', 'Line', '--json')).fix).toContain('--term "<Term>=<what it means for the business>"');
  });

  it('asks for the language first in a context whose glossary is empty', () => {
    const refused = cli(root, 'generate', 'aggregate', 'shipping', 'Parcel', '--json');

    expect(failure(refused).fix).toContain('define the ubiquitous language first');
  });

  it('refuses a technical word and an event that is not a fact, unless --allow-name', () => {
    expect(failure(cli(root, 'generate', 'aggregate', 'billing', 'InvoiceManager', '--json')).fix).toContain('ubiquitous language');
    expect(failure(cli(root, 'generate', 'entity', 'billing', 'InvoiceModel', '--json')).fix).toContain('language/no-technical-name');
    expect(failure(cli(root, 'generate', 'domain-event', 'billing', 'Invoice', 'Issue', '--json')).fix).toContain('past tense');
    expect(cli(root, 'generate', 'aggregate', 'billing', 'MarketData', '--allow-name', '--dry-run').code).toBe(0);
    expect(cli(root, 'generate', 'domain-event', 'billing', 'Invoice', 'Issue', '--allow-name', '--dry-run').code).toBe(0);
  });

  it('lists every TODO(domain) of the created files as file:line', () => {
    const result = report(cli(root, 'generate', 'entity', 'billing', 'InvoiceLine', '--term', 'Line=One billed item', '--json'));

    expect(result.next.length).toBeGreaterThan(0);
    expect(result.next).toEqual(result.todos.map((todo) => `${todo.file}:${todo.line}`));
    for (const todo of result.todos) {
      const line = read(root, todo.file).split('\n')[todo.line - 1] ?? '';
      expect(line).toContain('TODO(domain):');
      expect(line).toContain(todo.text.slice(0, 30));
    }
  });

  it('puts the definition of the language first in the next steps of a new context', () => {
    const result = report(cli(root, 'generate', 'context', 'catalog', '--classification', 'generic', '--upstream', 'billing:conformist', '--json'));

    expect(result.next[0]).toMatch(/^src\/contexts\/catalog\/CONTEXT\.md:\d+$/);
    expect(result.todos[0]?.text).toContain('define the ubiquitous language first');
    expect(result.updated).toEqual(expect.arrayContaining(['ddd-ts-kit.config.json', 'src/platform/application.ts', 'docs/context-map.md', 'src/contexts/billing/CONTEXT.md']));
    const config = JSON.parse(read(root, 'ddd-ts-kit.config.json')) as { contexts: Record<string, unknown> };
    expect(config.contexts['catalog']).toEqual({ classification: 'generic', upstreams: [{ context: 'billing', relationship: 'conformist' }] });
    expect(read(root, 'src/platform/application.ts')).toContain('catalogModule,');
    expect(read(root, 'src/contexts/catalog/CONTEXT.md')).toContain('- Downstream of `billing` (conformist).');
    expect(read(root, 'src/contexts/billing/CONTEXT.md')).toContain('- Upstream of `catalog` (conformist).');
  });

  it('writes the purpose and the terms given to a new context, and leaves markers otherwise', () => {
    cli(root, 'generate', 'context', 'pricing', '--classification', 'supporting', '--purpose', 'Sets the price of every item. Owns price lists.', '--term', 'Price list=The prices valid for a period');
    const doc = read(root, 'src/contexts/pricing/CONTEXT.md');

    expect(doc).toContain('## Purpose\n\nSets the price of every item. Owns price lists.\n');
    expect(doc).toContain('| Term | Meaning | Not to be confused with |\n|---|---|---|\n| Price list | The prices valid for a period |  |');
    expect(doc).not.toContain('define the ubiquitous language first');
    expect(read(root, 'src/contexts/catalog/CONTEXT.md')).toContain('TODO(domain): define the ubiquitous language first');
    expect(read(root, 'docs/context-map.md')).toContain('| `pricing` | supporting | Sets the price of every item. |');
  });

  it('prints the plan and writes nothing with --dry-run', () => {
    const result = cli(root, 'generate', 'domain-service', 'billing', 'InvoiceIssuing', '--dry-run');

    expect(result.stdout).toContain('would create src/contexts/billing/domain/services/invoice-issuing.service.ts');
    expect(exists(root, 'src/contexts/billing/domain/services/invoice-issuing.service.ts')).toBe(false);
  });

  it('never overwrites an existing file without --force', () => {
    const target = 'src/contexts/billing/domain/aggregates/invoice.aggregate.ts';
    write(root, target, 'export const edited = true;\n');

    const kept = report(cli(root, 'generate', 'aggregate', 'billing', 'Invoice', '--json'));
    expect(kept.skipped).toContain(target);
    expect(read(root, target)).toBe('export const edited = true;\n');

    const forced = report(cli(root, 'generate', 'aggregate', 'billing', 'Invoice', '--force', '--json'));
    expect(forced.updated).toContain(target);
    expect(read(root, target)).toContain('export class Invoice');
  });

  it('refuses a consumer of an upstream that is not declared, and says how to declare it', () => {
    const result = cli(root, 'generate', 'consumer', 'shipping', 'billing', 'billing.invoice.issued', '--json');

    expect(result.code).toBe(2);
    expect(failure(result).message).toContain('does not declare "billing" as an upstream');
    expect(failure(result).fix).toContain('contexts.shipping.upstreams');
    expect(failure(result).fix).toContain('"context": "billing"');
  });

  it('refuses what cannot compile yet and gives the command that creates the prerequisite', () => {
    const repository = cli(root, 'generate', 'repository', 'billing', 'Payment', '--json');
    expect(failure(repository).fix).toContain('ddd-ts-kit generate aggregate billing Payment');

    const builder = cli(root, 'generate', 'builder', 'billing', 'Payment', '--json');
    expect(failure(builder).fix).toContain('ddd-ts-kit generate aggregate billing Payment');

    const route = cli(root, 'generate', 'route', 'billing', 'PayInvoice', '--method', 'POST', '--path', '/payments', '--json');
    expect(failure(route).fix).toContain('ddd-ts-kit generate command billing PayInvoice');

    const e2e = cli(root, 'generate', 'e2e', 'billing', 'PayInvoice', '--json');
    expect(failure(e2e).fix).toContain('ddd-ts-kit generate route billing PayInvoice');
  });

  it('validates its arguments', () => {
    expect(failure(cli(root, 'generate', 'widget', 'billing', 'X', '--json')).message).toContain('Unknown kind');
    expect(failure(cli(root, 'generate', 'aggregate', 'billing', '--json')).message).toContain('expects 2 argument');
    expect(failure(cli(root, 'generate', 'aggregate', 'nowhere', 'Price', '--json')).message).toContain('Unknown context');
    expect(failure(cli(root, 'generate', 'context', 'returns', '--json')).fix).toContain('--classification');
    expect(failure(cli(root, 'generate', 'context', 'returns', '--classification', 'core', '--upstream', 'nowhere', '--json')).message).toContain('not declared');
    expect(failure(cli(root, 'generate', 'domain-error', 'billing', 'Refused', '--code', 'lower', '--json')).message).toContain('not a valid error code');
    expect(failure(cli(root, 'generate', 'aggregate', 'billing', 'Invoice', '--unknown', '--json')).message).toContain('--unknown');
  });

  it('describes the kinds in --help', () => {
    const help = cli(root, '--help').stdout;

    for (const kind of KINDS) expect(help).toContain(kind.usage);
    expect(KINDS.map((kind) => kind.name)).toEqual(expect.arrayContaining(['builder', 'e2e']));
  });
});

describe('generated code', () => {
  let root: string;
  let results: CliResult[];

  beforeAll(() => {
    root = tempDir('generated');
    results = scaffoldEverything(root);
  });

  it('carries no comment but the TODO(domain) and TODO(platform) ones and the marker regions', () => {
    const sources = walk(root, 'src/contexts').filter((file) => file.endsWith('.ts'));
    expect(sources.length).toBeGreaterThan(40);

    for (const file of sources) {
      const scanned = scan(read(root, file));
      expect(scanned.blockComments, file).toEqual([]);
      for (const comment of scanned.comments) {
        expect(comment.text, `${file}:${comment.line}`).toMatch(/^(TODO\((?:domain|platform)\): |\/?ddd-ts-kit:[\w-]+$)/);
      }
    }
  });

  it('says precisely where business knowledge is expected', () => {
    const todos = results.flatMap((result) => report(result).todos);

    expect(todos.length).toBeGreaterThan(40);
    for (const todo of todos) expect(todo.text.length, `${todo.file}:${todo.line}`).toBeGreaterThan(40);
  });

  it('gives every handler spec one real test through the bus, the refusal of an actor without the permission, and it.todo entries naming behaviours', () => {
    for (const spec of ['issue-invoice.handler.spec.ts', 'cancel-invoice.handler.spec.ts', 'list-invoices.handler.spec.ts']) {
      const text = read(root, `src/contexts/billing/test/unit/${spec}`);
      expect(text.match(/^\s*it\('/gm)?.length, spec).toBe(2);
      expect(text, spec).toContain("rejects.toMatchObject({ code: 'FORBIDDEN' })");
      expect(text, spec).toContain('new RoleBasedAuthorizer({ roles: { holder: [billingPermissions[');
      expect(text.match(/^\s*it\.todo\('/gm)?.length, spec).toBeGreaterThanOrEqual(2);
      expect(text, spec).toContain('createTestApplication({');
      expect(text, spec).toMatch(/application\.(commandBus|queryBus)\.execute\(/);
    }
  });

  it('registers each element in the module file between its markers', () => {
    const module = read(root, 'src/contexts/billing/billing.module.ts');

    expect(module).toContain("builder.bind(INVOICE_REPOSITORY).toClass(DrizzleInvoiceRepository, [DATABASE, EXECUTION_SCOPE, CLOCK]).as('repository');");
    expect(module).toContain("builder.command(IssueInvoiceCommand).requires(billingPermissions['invoice.issue']).handledBy(IssueInvoiceHandler, [INVOICE_REPOSITORY, DOMAIN_EVENTS, ID_GENERATOR, CLOCK]);");
    expect(module).toContain("builder.command(CancelInvoiceCommand).requires(billingPermissions['invoice.cancel']).handledBy(CancelInvoiceHandler);");
    expect(module).toContain("builder.query(ListInvoicesQuery).requires(billingPermissions['invoice.list']).handledBy(ListInvoicesHandler, [LIST_INVOICES_READER, ACCESS]);");
    expect(module).toContain('issueInvoiceRoute(resolve(COMMAND_BUS)),');
    expect(module).toContain('listInvoicesRoute(resolve(QUERY_BUS)),');
    expect(module).toContain('await resolve(INVOICE_ISSUED_PUBLISHER).publish(event);');
    expect(module).toContain('await resolve(INVOICE_ISSUED_V2_PUBLISHER).publish(event);');
    expect(module).toContain('await resolve(INVOICE_ISSUED_EVENT_HANDLER).handle(event);');
    expect(module.match(/from '@ddd-ts-kit\/di';/g)).toHaveLength(2);
  });

  it('gives the repository its ORM adapter, mapper, table, fake and one contract suite for both', () => {
    const persistence = 'src/contexts/billing/infrastructure/persistence';

    expect(read(root, `${persistence}/billing.schema.ts`)).toContain("export const invoices = billingSchema.table('invoices', {");
    expect(read(root, `${persistence}/invoice.mapper.ts`)).toContain('export const InvoiceMapper = {');
    expect(read(root, `${persistence}/drizzle-invoice.repository.ts`)).toContain('await optimisticUpdate(saved, async ({ expected, next }) => {');
    expect(read(root, 'src/platform/database/schema.ts')).toContain("export * from '../../contexts/billing/infrastructure/persistence/billing.schema.js';");
    expect(read(root, 'src/contexts/billing/test/fakes/invoice.repository.fake.ts')).toContain('extends InMemoryRepository<Invoice> implements InvoiceRepository');
    const contract = read(root, 'src/contexts/billing/test/integration/invoice.repository.contract.spec.ts');
    expect(contract.match(/repositoryContract<Invoice>\(runner, \{/g)).toHaveLength(2);
    expect(contract).toContain('database = await openTestDatabase();');
  });

  it('declares integration events in the published language and lists them', () => {
    expect(read(root, 'src/contexts/billing/published-language/index.ts')).toBe(
      "export * from './invoice-issued.v1.integration-event.js';\nexport * from './invoice-issued.v2.integration-event.js';\nexport * from './invoice-status.contract.js';\n",
    );
    expect(read(root, 'src/contexts/billing/published-language/invoice-issued.v2.integration-event.ts')).toContain(
      "export const invoiceIssuedV2 = defineIntegrationEvent({\n  type: 'billing.invoice.issued',\n  version: 2,",
    );
    expect(read(root, 'src/contexts/billing/CONTEXT.md')).toContain('- `billing.invoice.issued` (version 1)\n- `billing.invoice.issued` (version 2)');
  });

  it('types the consumer with the newest declaration of the upstream and subscribes it idempotently', () => {
    const consumer = read(root, 'src/contexts/shipping/application/integration/consumers/billing-invoice-issued.consumer.ts');
    const module = read(root, 'src/contexts/shipping/shipping.module.ts');

    expect(consumer).toContain("import type { InvoiceIssuedV2 } from '../../../../billing/published-language/index.js';");
    expect(consumer).toContain('constructor(private readonly commands: CommandBus) {}');
    expect(module).toContain("import { invoiceIssuedV2 as billingInvoiceIssuedDefinition } from '../billing/published-language/index.js';");
    expect(module).toContain("builder.on(billingInvoiceIssuedDefinition, { consumer: 'shipping.billing-invoice-issued' }).handledBy(BillingInvoiceIssuedConsumer, [COMMAND_BUS]);");
  });

  it('writes an end-to-end spec that drives the route of the use case', () => {
    const spec = read(root, 'test/e2e/issue-invoice.e2e.spec.ts');

    expect(spec).toContain("const response = await application.client.post('/invoices', {});");
    expect(spec).toContain('expectStatus(response, 201);');
    expect(spec).toContain('reportSeedOnFailure({ beforeEach, onTestFailed });');
    expect(read(root, 'test/e2e/track-purchase-order.e2e.spec.ts')).toContain("application.client.get('/purchase-orders/purchase-order-id-1/tracking');");
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

  it('maps the project for `list`, with the glossary size, the builders and the end-to-end specs', () => {
    const map = cli(root, 'list', '--json').json() as { contexts: Record<string, unknown>[]; e2e: string[] };

    expect(map.contexts).toEqual([
      expect.objectContaining({
        name: 'billing',
        classification: 'core',
        glossary: 9,
        upstreams: [],
        aggregates: ['Invoice'],
        commands: ['CancelInvoice', 'IssueInvoice'],
        queries: ['ListInvoices'],
        domainEvents: ['InvoiceIssued', 'InvoiceMarkedAsPaid'],
        publishedEvents: ['billing.invoice.issued@v1', 'billing.invoice.issued@v2'],
        builders: ['Invoice'],
      }),
      expect.objectContaining({ name: 'order-fulfilment', classification: 'generic', glossary: 3, aggregates: ['PurchaseOrder'], commands: ['PlacePurchaseOrder'], builders: ['PurchaseOrder'] }),
      expect.objectContaining({ name: 'shipping', classification: 'supporting', glossary: 1, upstreams: [{ context: 'billing', relationship: 'customer-supplier' }] }),
    ]);
    expect(map.e2e).toEqual(['issue-invoice', 'track-purchase-order']);
    const text = cli(root, 'list').stdout;
    expect(text).toContain('billing [core]\n  glossary: 9 terms\n  upstreams: none\n  aggregates: Invoice');
    expect(text).toContain('  builders: Invoice');
    expect(text).toContain('end-to-end specs: issue-invoice, track-purchase-order');
  });
});

describe('authorization, extraction and governance kinds', () => {
  let root: string;

  beforeAll(() => {
    root = tempDir('wave4');
    scaffoldEverything(root);
  });

  it('refuses a use case that declares neither a permission nor that it is public, and explains deny by default', () => {
    const refused = cli(root, 'generate', 'command', 'billing', 'IssueInvoice');

    expect(refused.code).toBe(2);
    expect(refused.stderr).toContain('declares neither a permission nor that it is public');
    expect(refused.stderr).toContain('Nothing is reachable by default');
    expect(cli(root, 'generate', 'command', 'billing', 'IssueInvoice', '--permission', 'invoice.issue', '--public').code).toBe(2);
    expect(cli(root, 'generate', 'command', 'billing', 'IssueInvoice', '--permission', 'refund.issue').stderr).toContain('"refund"');
  });

  it('declares each permission once, carries the actor in the message and lets the route name its security scheme', () => {
    const billing = 'src/contexts/billing';

    expect(read(root, `${billing}/application/authorization/billing.permissions.ts`).match(/'invoice\.(issue|cancel|list)':/g)).toHaveLength(3);
    expect(read(root, `${billing}/application/commands/issue-invoice/issue-invoice.command.ts`)).toContain('extends AuthorizedCommand<string>');
    expect(read(root, `${billing}/presentation/http/issue-invoice.route.ts`)).toContain("security: ['bearer'],");
    expect(read(root, `${billing}/presentation/http/issue-invoice.route.ts`)).toContain('new IssueInvoiceCommand(actorOf(input.context.principal))');
    expect(read(root, 'src/contexts/order-fulfilment/presentation/http/track-purchase-order.route.ts')).toContain('security: false,');
    expect(read(root, 'src/contexts/shipping/application/integration/consumers/billing-invoice-issued.consumer.ts')).toContain("systemActor('shipping.billing-invoice-issued')");
  });

  it('writes a policy with its spec and registers it with the policies Access asks', () => {
    expect(read(root, 'src/contexts/billing/application/authorization/only-issuer-cancels.policy.ts')).toContain("permission: billingPermissions['invoice.cancel'],");
    expect(read(root, 'src/platform/auth/access-policies.ts')).toContain('onlyIssuerCancels,');
    expect(walk(root, 'src/contexts/billing/test/unit')).toContain('src/contexts/billing/test/unit/only-issuer-cancels.policy.spec.ts');
  });

  it('gives a gateway its port, its in-process adapter over the published contract of the upstream, a fake and one contract suite', () => {
    const adapter = read(root, 'src/contexts/shipping/infrastructure/external/in-process-invoice-status.gateway.ts');

    expect(adapter).toContain("from '../../../billing/published-language/index.js'");
    expect(adapter).toContain('TODO(platform): when billing runs as its own service');
    expect(read(root, 'src/contexts/shipping/shipping.module.ts')).toContain(".toClass(InProcessInvoiceStatusGateway, [INVOICE_STATUS_UPSTREAM]).as('gateway');");
    expect(cli(root, 'generate', 'gateway', 'billing', 'shipping', 'Parcels').stderr).toContain('does not declare "shipping" as an upstream');
  });

  it('makes a context a service: entry point, start script, compose service, deployable in the config, and a test booting each context alone', () => {
    const config = JSON.parse(read(root, 'ddd-ts-kit.config.json')) as { contexts: Record<string, { deployable?: boolean }> };

    expect(read(root, 'src/apps/shipping/main.ts')).toContain('{ modules: [shippingModule], routes: [SHIPPING_ROUTES] }');
    expect(read(root, 'package.json')).toContain('"start:shipping": "node dist/src/apps/shipping/main.js"');
    expect(read(root, 'docker-compose.yml')).toContain('ENTRY: dist/src/apps/shipping/main.js');
    expect(config.contexts['shipping']?.deployable).toBe(true);
    expect(config.contexts['billing']?.deployable).toBeUndefined();
    expect(read(root, 'test/architecture/extractable.spec.ts').match(/^ {2}\['[a-z-]+', \w+Module\],$/gm)).toHaveLength(3);
  });

  it('numbers decision records and records a deviation with the entry of the config that points to it', () => {
    const report = cli(root, 'generate', 'adr', 'Allow a longer handler', '--deviation', 'rules.clean/function-size', '--reason', 'One import script', '--json').json() as { created: string[] };
    const config = JSON.parse(read(root, 'ddd-ts-kit.config.json')) as { deviations: unknown[] };

    expect(walk(root, 'docs/adr')).toEqual(['docs/adr/0001-keep-shipping-in-the-same-repository-as-billing.md', 'docs/adr/0002-allow-a-longer-handler.md']);
    expect(report.created).toEqual(['docs/adr/0002-allow-a-longer-handler.md']);
    expect(read(root, 'docs/adr/0002-allow-a-longer-handler.md')).toContain('## Removal condition');
    expect(config.deviations).toEqual([{ what: 'rules.clean/function-size', adr: '0002', reason: 'One import script' }]);
  });

  it('lists permissions, policies, gateways and what is deployable, and documents them', () => {
    const listed = cli(root, 'list').stdout;

    expect(listed).toContain('permissions: invoice.issue, invoice.cancel, invoice.list');
    expect(listed).toContain('policies: OnlyIssuerCancels');
    expect(listed).toContain('gateways: InvoiceStatus');
    expect(listed).toContain('deployable alone: yes');
    expect(read(root, 'src/contexts/billing/CONTEXT.md')).toContain('- `billing:invoice.cancel`');
    expect(read(root, 'docs/context-map.md')).toMatch(/\| `shipping` \|.*\| yes \|/);
    expect(read(root, 'docs/integration/README.md')).toContain('Same process, no broker');
  });
});
