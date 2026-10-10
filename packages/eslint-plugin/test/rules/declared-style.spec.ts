import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterAll } from 'vitest';
import { authzDeclared } from '../../src/rules/authz-declared.js';
import { authzInApplication } from '../../src/rules/authz-in-application.js';
import { contextExtractable } from '../../src/rules/context-extractable.js';
import { declarationsRoleDeclared } from '../../src/rules/declarations-role-declared.js';
import { eventsConsumerIdempotent } from '../../src/rules/events-consumer-idempotent.js';
import { layerApplicationInward } from '../../src/rules/layer-application-inward.js';
import { layerDomainPurity } from '../../src/rules/layer-domain-purity.js';
import { at, BILLING, ruleTester, SAMPLE_CONFIG } from '../support/rule-tester.js';

const DECLARED = { ...SAMPLE_CONFIG, stack: { style: 'declared', assembly: 'barrel' } };
const EXPLICIT = { ...SAMPLE_CONFIG, stack: { style: 'explicit' } };

const MODULE = `${BILLING}/billing.module.ts`;
const COMMAND = `${BILLING}/application/commands/issue-invoice/issue-invoice.command.ts`;
const QUERY = `${BILLING}/application/queries/list-invoices/list-invoices.query.ts`;
const HANDLER = `${BILLING}/application/commands/issue-invoice/issue-invoice.handler.ts`;
const QUERY_HANDLER = `${BILLING}/application/queries/list-invoices/list-invoices.handler.ts`;
const INTEGRATION_HANDLER = `${BILLING}/application/integration/handlers/catalog-product-listed.integration-handler.ts`;
const EVENT_HANDLER = `${BILLING}/application/event-handlers/invoice-issued.event-handler.ts`;
const PUBLISHER = `${BILLING}/application/integration/publishers/invoice-issued.publisher.ts`;
const POLICY = `${BILLING}/application/authorization/only-issuer-voids.policy.ts`;
const PERMISSIONS = `${BILLING}/application/authorization/billing.permissions.ts`;
const PORTS = `${BILLING}/application/ports/billing.ports.ts`;
const REPOSITORY = `${BILLING}/infrastructure/persistence/knex-invoice.repository.ts`;
const GATEWAY = `${BILLING}/infrastructure/external/in-process-price-catalog.gateway.ts`;
const ADAPTER = `${BILLING}/infrastructure/external/remote-payment-provider.adapter.ts`;
const MAPPER = `${BILLING}/infrastructure/persistence/invoice.mapper.ts`;
const ROUTE = `${BILLING}/presentation/http/issue-invoice.route.ts`;
const AGGREGATE = `${BILLING}/domain/aggregates/invoice.aggregate.ts`;
const EVENT = `${BILLING}/domain/events/invoice-issued.event.ts`;
const SPEC = `${BILLING}/test/unit/issue-invoice.handler.spec.ts`;

const DECLARATIONS = '@ddd-ts-kit/kernel/declarations';
const declaring = (names: string, code: string): string => `import { ${names} } from '${DECLARATIONS}';\n${code}`;

/** A project on disk, for what is read from the file a class is imported from. */
const root = fs.mkdtempSync(path.join(os.tmpdir(), 'ddd-ts-kit-declared-'));
afterAll(() => {
  fs.rmSync(root, { recursive: true, force: true });
});

function onDisk(file: string, code: string): void {
  fs.mkdirSync(path.join(root, path.dirname(file)), { recursive: true });
  fs.writeFileSync(path.join(root, file), code);
}

function inProject(file: string, code: string, config: Record<string, unknown> = DECLARED): { code: string; settings: Record<string, unknown> } {
  return { code, settings: { 'ddd-ts-kit': { config, filename: file, rootDir: root } } };
}

onDisk(COMMAND, declaring('Requires', "@Requires(billingPermissions['invoice.issue'])\nexport class IssueInvoiceCommand extends AuthorizedCommand<string> {}"));
onDisk(QUERY, declaring('Public as Open', '@Open()\nexport class ListInvoicesQuery extends Query<Invoice[]> {}'));
onDisk(`${BILLING}/application/commands/void-invoice/void-invoice.command.ts`, 'export class VoidInvoiceCommand extends AuthorizedCommand<void> {}');
onDisk(`${BILLING}/application/commands/pay-invoice/pay-invoice.command.ts`, "import { Requires } from './home-made.js';\n@Requires('x')\nexport class PayInvoiceCommand extends AuthorizedCommand<void> {}");
onDisk(EVENT, "export class InvoiceIssued extends DomainEvent { readonly name = 'billing.invoice.issued' as const; }");
onDisk(`${BILLING}/domain/events/broken.event.ts`, 'export class Broken {');

const REGISTERS_DECORATED = "import { IssueInvoiceCommand } from './application/commands/issue-invoice/issue-invoice.command.js';\nimport { ListInvoicesQuery as ListInvoices } from '@/contexts/billing/application/queries/list-invoices/list-invoices.query.js';\nbuilder.command(IssueInvoiceCommand).handledBy(IssueInvoiceHandler, [INVOICES]);\nbuilder.query(ListInvoices).handledBy(ListInvoicesHandler, [INVOICES]);";

ruleTester.run('authz-declared in the declared style', authzDeclared, {
  valid: [
    at(COMMAND, declaring('Requires', "@Requires(billingPermissions['invoice.issue'])\nexport class IssueInvoiceCommand extends AuthorizedCommand<string> {}"), DECLARED),
    at(QUERY, declaring('Public', '@Public()\nexport class GetCatalogQuery extends Query<Catalog> {}'), DECLARED),
    at(QUERY, declaring('Public as Open', '@Open()\nclass GetCatalogQuery extends Query<Catalog> {}\nexport { GetCatalogQuery };'), DECLARED),
    at(COMMAND, `import * as declarations from '${DECLARATIONS}';\n@declarations.Requires(permission)\nexport class IssueInvoiceCommand extends AuthorizedCommand<string> {}`, DECLARED),
    at(COMMAND, 'class Draft {}\nexport type IssueInvoiceInput = { readonly customerId: string };', DECLARED),
    at(COMMAND, 'export class IssueInvoiceCommand extends AuthorizedCommand<string> {}', EXPLICIT),
    at(COMMAND, 'export class IssueInvoiceCommand extends AuthorizedCommand<string> {}'),
    at(HANDLER, 'export class IssueInvoiceHandler {}', DECLARED),
    at(`${BILLING}/application/ports/issue-invoice.command.ts`, 'export class IssueInvoiceCommand {}', DECLARED),
    at(`${BILLING}/test/unit/issue-invoice.command.ts`, 'export class IssueInvoiceCommand {}', DECLARED),
    at(COMMAND, 'export class IssueInvoiceCommand extends AuthorizedCommand<string> {}', { ...DECLARED, rules: { 'authz/declared': 'off' } }),
    at(MODULE, declaring('Public', '@Public()\nclass Health extends Query<string> {}\nbuilder.query(Health).handledBy(HealthHandler);')),
    inProject(MODULE, REGISTERS_DECORATED, EXPLICIT),
    inProject(MODULE, REGISTERS_DECORATED),
  ],
  invalid: [
    { ...at(COMMAND, 'export class IssueInvoiceCommand extends AuthorizedCommand<string> {}', DECLARED), errors: [{ messageId: 'message', data: { kind: 'command', className: 'IssueInvoiceCommand' } }] },
    { ...at(QUERY, 'class ListInvoicesQuery extends AuthorizedQuery<Invoice[]> {}\nexport default ListInvoicesQuery;', DECLARED), errors: [{ messageId: 'message', data: { kind: 'query', className: 'ListInvoicesQuery' } }] },
    { ...at(COMMAND, "import { Requires } from './home-made.js';\n@Requires(permission)\nexport class IssueInvoiceCommand extends AuthorizedCommand<string> {}", DECLARED), errors: [{ messageId: 'message' }] },
    { ...at(COMMAND, declaring('CommandHandler', '@CommandHandler(Other, [])\nexport class IssueInvoiceCommand extends AuthorizedCommand<string> {}'), DECLARED), errors: [{ messageId: 'message' }] },
    { ...at(COMMAND, declaring('Requires', '@Requires(a)\nexport class A extends AuthorizedCommand<string> {}\nexport class B extends AuthorizedCommand<string> {}'), DECLARED), errors: [{ messageId: 'message', data: { kind: 'command', className: 'B' } }] },
    { ...at(MODULE, 'class Health extends Query<string> {}\nbuilder.query(Health).handledBy(HealthHandler);'), errors: [{ messageId: 'useCase' }] },
    { ...at(MODULE, "import { Requires } from './home-made.js';\n@Requires(p)\nclass Health extends Query<string> {}\nbuilder.query(Health).handledBy(HealthHandler);", DECLARED), errors: [{ messageId: 'useCase' }] },
    {
      ...inProject(MODULE, "import { VoidInvoiceCommand } from './application/commands/void-invoice/void-invoice.command.js';\nimport { PayInvoiceCommand } from './application/commands/pay-invoice/pay-invoice.command.js';\nimport { Missing } from './application/commands/missing/missing.command.js';\nbuilder.command(VoidInvoiceCommand).handledBy(A);\nbuilder.command(PayInvoiceCommand).handledBy(B);\nbuilder.command(Missing).handledBy(C);", EXPLICIT),
      errors: [{ messageId: 'useCase', data: { kind: 'command', name: 'VoidInvoiceCommand', binding: 'handledBy' } }, { messageId: 'useCase', line: 5 }, { messageId: 'useCase', line: 6 }],
    },
  ],
});

ruleTester.run('authz-in-application in the declared style', authzInApplication, {
  valid: [
    at(COMMAND, declaring('Requires, Public', ''), DECLARED),
    at(POLICY, declaring('Policy', "import { ACCESS } from '@ddd-ts-kit/auth';"), DECLARED),
    at(QUERY_HANDLER, `import { ACCESS, type Access } from '@ddd-ts-kit/auth';\nimport { QueryHandler } from '${DECLARATIONS}';`, DECLARED),
    at(REPOSITORY, declaring('CLOCK, EXECUTION_SCOPE, Repository', ''), DECLARED),
    at(ROUTE, declaring('COMMAND_BUS', ''), DECLARED),
    at(REPOSITORY, declaring('Requires, Public, Policy', "import { ACCESS } from '@ddd-ts-kit/auth';"), EXPLICIT),
    at(ROUTE, declaring('Requires, Public, Policy', '')),
    at(SPEC, declaring('Requires, Policy', "import { ACCESS } from '@ddd-ts-kit/auth';"), DECLARED),
    at('src/platform/auth/access.ts', declaring('Policy', "import { ACCESS } from '@ddd-ts-kit/auth';"), DECLARED),
  ],
  invalid: [
    { ...at(ROUTE, declaring('Requires, Public as Open, COMMAND_BUS', ''), DECLARED), errors: [{ messageId: 'declaredOutside', data: { layer: 'presentation', name: 'Requires', specifier: DECLARATIONS } }, { messageId: 'declaredOutside', data: { layer: 'presentation', name: 'Public', specifier: DECLARATIONS } }] },
    { ...at(ROUTE, "import { ACCESS } from '@ddd-ts-kit/auth';", DECLARED), errors: [{ messageId: 'authorizerImport', data: { name: 'ACCESS' } }] },
    { ...at(REPOSITORY, declaring('Policy, Repository', "import { ACCESS, type Access } from '@ddd-ts-kit/auth';"), DECLARED), errors: [{ messageId: 'declaredOutside', data: { layer: 'infrastructure', name: 'Policy', specifier: DECLARATIONS } }, { messageId: 'declaredOutside', data: { layer: 'infrastructure', name: 'ACCESS', specifier: '@ddd-ts-kit/auth' } }] },
    { ...at(REPOSITORY, `export { Requires } from '${DECLARATIONS}';\nawait this.access.authorize(actor, permission, row);`, DECLARED), errors: [{ messageId: 'declaredOutside' }, { messageId: 'decision' }] },
    { ...at(AGGREGATE, "import { ACCESS } from '@ddd-ts-kit/auth';", DECLARED), errors: [{ messageId: 'authInDomain' }] },
  ],
});

ruleTester.run('layer-application-inward in the declared style', layerApplicationInward, {
  valid: [
    at(HANDLER, declaring('CLOCK, CommandHandler, DOMAIN_EVENTS, ID_GENERATOR', ''), DECLARED),
    at(HANDLER, declaring('CommandHandler', ''), { ...DECLARED, applicationAllowedPackages: ['decimal.js'] }),
    at(HANDLER, declaring('CommandHandler', ''), EXPLICIT),
    at(HANDLER, declaring('CommandHandler', '')),
    at(REPOSITORY, declaring('Repository', "import { knex } from 'knex';"), DECLARED),
  ],
  invalid: [
    { ...at(HANDLER, declaring('CommandHandler', ''), { ...EXPLICIT, applicationAllowedPackages: ['decimal.js'] }), errors: [{ messageId: 'package', data: { name: '@ddd-ts-kit/kernel', context: 'billing' } }] },
    { ...at(HANDLER, "import type { Clock } from '@ddd-ts-kit/kernel';", { ...DECLARED, applicationAllowedPackages: ['decimal.js'] }), errors: [{ messageId: 'package' }] },
    { ...at(HANDLER, "import { Retry } from '@ddd-ts-kit/aspects/decorators';\nimport { KnexInvoiceRepository } from '../../../infrastructure/persistence/knex-invoice.repository.js';", DECLARED), errors: [{ messageId: 'outsideConcern' }, { messageId: 'outward' }] },
  ],
});

ruleTester.run('layer-domain-purity in the declared style', layerDomainPurity, {
  valid: [
    at(AGGREGATE, "import { AggregateRoot } from '@ddd-ts-kit/kernel';", DECLARED),
    at(AGGREGATE, declaring('token', ''), EXPLICIT),
    at(AGGREGATE, declaring('token', '')),
    at(`${BILLING}/test/unit/invoice.aggregate.spec.ts`, declaring('CLOCK', ''), DECLARED),
    at(REPOSITORY, declaring('Repository', ''), DECLARED),
  ],
  invalid: [
    { ...at(AGGREGATE, declaring('Repository', ''), DECLARED), errors: [{ messageId: 'declarations' }] },
    { ...at(`${BILLING}/domain/repositories/invoice.repository.ts`, `import type { Token } from '${DECLARATIONS}';`, DECLARED), errors: [{ messageId: 'declarations' }] },
    { ...at(AGGREGATE, `const declarations = await import('${DECLARATIONS}');`, { ...DECLARED, domainAllowedPackages: ['@ddd-ts-kit/kernel'] }), errors: [{ messageId: 'declarations' }] },
    { ...at(AGGREGATE, "import { z } from 'zod';", DECLARED), errors: [{ messageId: 'package' }] },
  ],
});

const REACTION = "export class CatalogProductListedHandler { async handle(event: ProductListedV1): Promise<void> {} }";

ruleTester.run('events-consumer-idempotent in the declared style', eventsConsumerIdempotent, {
  valid: [
    at(INTEGRATION_HANDLER, declaring('COMMAND_BUS, IntegrationEventHandler', `@IntegrationEventHandler(productListedV1, { consumer: 'billing.catalog-product-listed' }, [COMMAND_BUS])\n${REACTION}`), DECLARED),
    at(INTEGRATION_HANDLER, declaring('IntegrationEventHandler as Handles', `@Handles(productListedV1, { ...shared, consumer: \`billing.catalog-product-listed\` }, [])\n${REACTION}`), DECLARED),
    at(INTEGRATION_HANDLER, REACTION, DECLARED),
    at(INTEGRATION_HANDLER, `import { IntegrationEventHandler } from './home-made.js';\n@IntegrationEventHandler(productListedV1)\n${REACTION}`, DECLARED),
    at(INTEGRATION_HANDLER, declaring('IntegrationEventHandler', `@IntegrationEventHandler(productListedV1, { consumer: NAME }, [])\n${REACTION}`), EXPLICIT),
    at(INTEGRATION_HANDLER, declaring('IntegrationEventHandler', `@IntegrationEventHandler(productListedV1)\n${REACTION}`)),
    at(SPEC, declaring('IntegrationEventHandler', `@IntegrationEventHandler(productListedV1)\n${REACTION}`), DECLARED),
    at(MODULE, "builder.on(productListedV1, { consumer: 'billing.price-list' }).handledBy(ProductListedHandler, [COMMAND_BUS]);", DECLARED),
  ],
  invalid: [
    { ...at(INTEGRATION_HANDLER, declaring('IntegrationEventHandler', `@IntegrationEventHandler(productListedV1, { consumer: NAME }, [])\n${REACTION}`), DECLARED), errors: [{ messageId: 'declaredName', data: { className: 'CatalogProductListedHandler', problem: 'not a string literal', context: 'billing' } }] },
    { ...at(INTEGRATION_HANDLER, declaring('IntegrationEventHandler', `@IntegrationEventHandler(productListedV1, { consumer: \`billing.\${reaction}\` }, [])\n${REACTION}`), DECLARED), errors: [{ messageId: 'declaredName', data: { className: 'CatalogProductListedHandler', problem: 'not a string literal', context: 'billing' } }] },
    { ...at(INTEGRATION_HANDLER, declaring('IntegrationEventHandler', `@IntegrationEventHandler(productListedV1, { consumer: '' }, [])\n${REACTION}`), DECLARED), errors: [{ messageId: 'declaredName', data: { className: 'CatalogProductListedHandler', problem: 'empty', context: 'billing' } }] },
    { ...at(INTEGRATION_HANDLER, declaring('IntegrationEventHandler', `@IntegrationEventHandler(productListedV1)\n${REACTION}`), DECLARED), errors: [{ messageId: 'declaredName', data: { className: 'CatalogProductListedHandler', problem: 'missing', context: 'billing' } }] },
    { ...at(INTEGRATION_HANDLER, declaring('IntegrationEventHandler', `@IntegrationEventHandler(productListedV1, {}, [])\n${REACTION}`), DECLARED), errors: [{ messageId: 'declaredName', data: { className: 'CatalogProductListedHandler', problem: 'missing', context: 'billing' } }] },
    { ...at(INTEGRATION_HANDLER, declaring('IntegrationEventHandler', `@IntegrationEventHandler(productListedV1, options, [])\n${REACTION}`), DECLARED), errors: [{ messageId: 'declaredName' }] },
    { ...at(INTEGRATION_HANDLER, `import * as declarations from '${DECLARATIONS}';\n@declarations.IntegrationEventHandler(productListedV1, { ...shared })\n${REACTION}`, DECLARED), errors: [{ messageId: 'declaredName', data: { className: 'CatalogProductListedHandler', problem: 'not a string literal', context: 'billing' } }] },
    { ...at(MODULE, 'builder.on(productListedV1).handledBy(ProductListedHandler, [COMMAND_BUS]);', DECLARED), errors: [{ messageId: 'consumerName' }] },
    { ...at(INTEGRATION_HANDLER, "this.subscriber.subscribe('catalog.product.listed', (event) => this.handle(event));", DECLARED), errors: [{ messageId: 'directSubscribe' }] },
  ],
});

const CATALOG_PORTS = "'../../../../catalog/application/ports/catalog.ports.js'";
const CATALOG_LANGUAGE = "'../../../../catalog/published-language/index.js'";

ruleTester.run('context-extractable in the declared style', contextExtractable, {
  valid: [
    at(HANDLER, `import { CLOCK, CommandHandler, DOMAIN_EVENTS } from '${DECLARATIONS}';\nimport { ACCESS } from '@ddd-ts-kit/auth';\nimport { INVOICE_REPOSITORY } from '../../ports/billing.ports.js';\nimport { DATABASE } from '@/platform/tokens.js';`, DECLARED),
    at(INTEGRATION_HANDLER, `import { productListedV1, type ProductListedV1 } from ${CATALOG_LANGUAGE};`, DECLARED),
    at(REPOSITORY, "import { DATABASE } from '../../../../platform/tokens.js';\nimport { INVOICE_REPOSITORY } from '../../application/ports/billing.ports.js';\nimport { DEFAULT_CURRENCY } from '@/shared-kernel/money.vo.js';\nimport { SQL } from 'drizzle-orm';", DECLARED),
    at(HANDLER, `import { PRODUCT_READER } from ${CATALOG_PORTS};`, EXPLICIT),
    at(HANDLER, `import { PRODUCT_READER } from ${CATALOG_PORTS};`),
    at(PORTS, `import { PRODUCT_READER } from ${CATALOG_PORTS};`, DECLARED),
    at(MAPPER, `import { PRODUCT_READER } from ${CATALOG_PORTS};`, DECLARED),
    at(SPEC, `import { PRODUCT_READER } from ${CATALOG_PORTS};`, DECLARED),
    at(MODULE, "import { CATALOG_READER } from '@/contexts/catalog/catalog.module.js';\nexport const all = describe(CATALOG_READER);", DECLARED),
  ],
  invalid: [
    { ...at(HANDLER, `import { PRODUCT_READER } from ${CATALOG_PORTS};`, DECLARED), errors: [{ messageId: 'foreignToken', data: { here: 'billing', there: 'catalog', name: 'PRODUCT_READER' } }] },
    { ...at(QUERY_HANDLER, `import { PRODUCT_READER as products, type ProductReader } from ${CATALOG_PORTS};`, DECLARED), errors: [{ messageId: 'foreignToken', data: { here: 'billing', there: 'catalog', name: 'PRODUCT_READER' } }, { messageId: 'foreignToken', data: { here: 'billing', there: 'catalog', name: 'ProductReader' } }] },
    { ...at(GATEWAY, "import { PRICE_CATALOG, productListedV1 } from '@/contexts/catalog/published-language/index.js';", DECLARED), errors: [{ messageId: 'foreignToken', data: { here: 'billing', there: 'catalog', name: 'PRICE_CATALOG' } }] },
    { ...at(REPOSITORY, "import { CATALOG_DATABASE } from '@/contexts/catalog/infrastructure/persistence/catalog.tokens.js';\nconst rows = await sql`select * from billing.invoices`;", DECLARED), errors: [{ messageId: 'foreignToken', data: { here: 'billing', there: 'catalog', name: 'CATALOG_DATABASE' } }] },
    { ...at(COMMAND, `import * as catalog from ${CATALOG_PORTS};`, DECLARED), errors: [{ messageId: 'foreignToken', data: { here: 'billing', there: 'catalog', name: 'catalog' } }] },
    { ...at(MODULE, "import { CATALOG_READER } from '@/contexts/catalog/catalog.module.js';\nbuilder.query(GetPrice).public().handledBy(GetPriceHandler, [CATALOG_READER]);", DECLARED), errors: [{ messageId: 'foreignWiring' }] },
  ],
});

const role = (suffix: string, folder: string, expected: string): Record<string, string> => ({ suffix, folder, expected });
const ISSUED = "@DomainEventHandler(InvoiceIssued, { name: 'billing.invoice.issued' })\nexport class InvoiceIssuedEventHandler { async handle(event: InvoiceIssued): Promise<void> {} }";
const ISSUED_EVENT = "import { InvoiceIssued } from '../../domain/events/invoice-issued.event.js';";

ruleTester.run('declarations-role-declared', declarationsRoleDeclared, {
  valid: [
    at(HANDLER, declaring('CLOCK, CommandHandler', '@CommandHandler(IssueInvoiceCommand, [INVOICE_REPOSITORY, CLOCK])\nexport class IssueInvoiceHandler implements CommandHandler<IssueInvoiceCommand> {}'), DECLARED),
    at(QUERY_HANDLER, declaring('QueryHandler', '@QueryHandler(ListInvoicesQuery, [READER])\nclass ListInvoicesHandler {}\nexport { ListInvoicesHandler };'), DECLARED),
    at(INTEGRATION_HANDLER, declaring('IntegrationEventHandler', "@IntegrationEventHandler(productListedV1, { consumer: 'billing.catalog-product-listed' }, [COMMAND_BUS])\nexport class CatalogProductListedHandler {}"), DECLARED),
    at(EVENT_HANDLER, declaring('DomainEventHandler', ISSUED), DECLARED),
    at(PUBLISHER, declaring('DomainEventHandler as Reacts', "@Reacts(InvoiceIssued, { name: 'billing.invoice.issued' }, [EVENT_PUBLISHER, ID_GENERATOR])\nexport class InvoiceIssuedPublisher {}"), DECLARED),
    at(POLICY, declaring('Policy', "@Policy(billingPermissions['invoice.void'], { name: 'billing.only-issuer-voids' })\nexport class OnlyIssuerVoidsPolicy {}"), DECLARED),
    at(REPOSITORY, declaring('Repository', '@Repository(INVOICE_REPOSITORY, [DATABASE])\nexport class KnexInvoiceRepository implements InvoiceRepository {}'), DECLARED),
    at(GATEWAY, `import * as declarations from '${DECLARATIONS}';\n@declarations.Gateway(PRICE_CATALOG_GATEWAY, [PRICE_CATALOG_UPSTREAM])\nexport class InProcessPriceCatalogGateway {}`, DECLARED),
    at(ADAPTER, declaring('Adapter', "import { Retry } from '@ddd-ts-kit/aspects/decorators';\n@Adapter(PAYMENT_PROVIDER, { kind: 'external' })\n@Retry({ attempts: 3 })\nexport class RemotePaymentProvider {}\nclass Helper {}"), DECLARED),
    at(COMMAND, 'export class IssueInvoiceCommand extends AuthorizedCommand<string> {}', DECLARED),
    at(COMMAND, declaring('CommandHandler', '@CommandHandler(X, [])\nexport class IssueInvoiceCommand {}'), DECLARED),
    at(PERMISSIONS, 'export const billingPermissions = definePermissions({});', DECLARED),
    at(PORTS, declaring('token', "export const INVOICE_REPOSITORY = token<InvoiceRepository>('billing.InvoiceRepository');"), DECLARED),
    at(MAPPER, 'export class InvoiceMapper {}', DECLARED),
    at(`${BILLING}/application/commands/issue-invoice/issue-invoice.integration-handler.ts`, 'export class Misplaced {}', DECLARED),
    at(`${BILLING}/application/queries/list-invoices/list-invoices.event-handler.ts`, 'export class Misplaced {}', DECLARED),
    at(`${BILLING}/application/integration/consumers/catalog-product-listed.consumer.ts`, 'export class FormerName {}', DECLARED),
    at(`${BILLING}/domain/repositories/invoice.repository.ts`, 'export interface InvoiceRepository {}', DECLARED),
    at(AGGREGATE, "import { Repository } from './home-made.js';\n@Repository(X)\nexport class Invoice {}", DECLARED),
    at(SPEC, declaring('CommandHandler', '@CommandHandler(X, [])\nclass Probe {}'), DECLARED),
    at(`${BILLING}/application/commands/issue-invoice/issue-invoice.handler.spec.ts`, 'export class Probe {}', DECLARED),
    at(MODULE, declaring('Policy', '@Policy(permission, { name: NAME })\nclass Inline {}'), EXPLICIT),
    at(HANDLER, 'export class IssueInvoiceHandler {}', EXPLICIT),
    at(HANDLER, 'export class IssueInvoiceHandler {}'),
    at(AGGREGATE, declaring('Repository', '@Repository(X)\nexport class Invoice {}'), EXPLICIT),
    at(EVENT_HANDLER, declaring('DomainEventHandler', "@DomainEventHandler(InvoiceIssued, { name: 'billing.invoice.paid' })\nexport class InvoiceIssuedEventHandler {}"), EXPLICIT),
    at(HANDLER, 'export class IssueInvoiceHandler {}', { ...DECLARED, rules: { 'declarations/role-declared': 'off' } }),
    at(HANDLER, '// ddd-ts-kit-disable-next-line declarations/role-declared -- ADR-0012: registered by the legacy module until the migration ends\nexport class IssueInvoiceHandler {}', DECLARED),
    at(EVENT_HANDLER, declaring('DomainEventHandler', `class InvoiceIssued { readonly name = 'billing.invoice.issued'; }\n${ISSUED}`), DECLARED),
    at(EVENT_HANDLER, declaring('DomainEventHandler', `class InvoiceIssued { static readonly type = 'x'; get name(): string { return compute(); } }\n${ISSUED}`), DECLARED),
    inProject(EVENT_HANDLER, declaring('DomainEventHandler', `${ISSUED_EVENT}\n${ISSUED}`)),
    inProject(EVENT_HANDLER, declaring('DomainEventHandler', `import { Broken as InvoiceIssued } from '../../domain/events/broken.event.js';\n${ISSUED}`)),
    inProject(EVENT_HANDLER, declaring('DomainEventHandler', `import { InvoiceIssued } from '../../domain/events/index.js';\n${ISSUED}`)),
  ],
  invalid: [
    { ...at(HANDLER, 'export class IssueInvoiceHandler {}', DECLARED), errors: [{ messageId: 'undeclared', data: role('handler', 'application/commands', 'CommandHandler'), line: 1, column: 14 }] },
    { ...at(HANDLER, 'export const handle = (): void => undefined;', DECLARED), errors: [{ messageId: 'undeclared', line: 1, column: 1 }] },
    { ...at(HANDLER, declaring('CommandHandler', '@CommandHandler(IssueInvoiceCommand, [])\nclass IssueInvoiceHandler {}'), DECLARED), errors: [{ messageId: 'undeclared' }] },
    { ...at(HANDLER, "import { CommandHandler } from './home-made.js';\n@CommandHandler(IssueInvoiceCommand, [])\nexport class IssueInvoiceHandler {}", DECLARED), errors: [{ messageId: 'undeclared' }] },
    { ...at(HANDLER, declaring('QueryHandler', '@QueryHandler(ListInvoicesQuery, [])\nexport class IssueInvoiceHandler {}'), DECLARED), errors: [{ messageId: 'wrongRole', data: { ...role('handler', 'application/commands', 'CommandHandler'), className: 'IssueInvoiceHandler', actual: 'QueryHandler' } }] },
    { ...at(QUERY_HANDLER, declaring('CommandHandler as Handles', '@Handles(IssueInvoiceCommand, [])\nexport class ListInvoicesHandler {}'), DECLARED), errors: [{ messageId: 'wrongRole', data: { ...role('handler', 'application/queries', 'QueryHandler'), className: 'ListInvoicesHandler', actual: 'CommandHandler' } }] },
    { ...at(REPOSITORY, declaring('Adapter, Repository', '@Repository(A, [])\nexport class KnexInvoiceRepository {}\n@Adapter(B, {})\nclass Cache {}'), DECLARED), errors: [{ messageId: 'wrongRole', line: 4, data: { ...role('repository', 'infrastructure/persistence', 'Repository'), className: 'Cache', actual: 'Adapter' } }] },
    { ...at(INTEGRATION_HANDLER, declaring('CommandHandler', '@CommandHandler(IssueInvoiceCommand, [])\nexport class CatalogProductListedHandler {}'), DECLARED), errors: [{ messageId: 'wrongRole', data: { ...role('integration-handler', 'application/integration/handlers', 'IntegrationEventHandler'), className: 'CatalogProductListedHandler', actual: 'CommandHandler' } }] },
    { ...at(EVENT_HANDLER, 'export class InvoiceIssuedEventHandler {}', DECLARED), errors: [{ messageId: 'undeclared', data: role('event-handler', 'application/event-handlers', 'DomainEventHandler') }] },
    { ...at(GATEWAY, 'export class InProcessPriceCatalogGateway {}', DECLARED), errors: [{ messageId: 'undeclared', data: role('gateway', 'infrastructure', 'Gateway') }] },
    { ...at(ADAPTER, declaring('Gateway', '@Gateway(PAYMENT_PROVIDER)\nexport class RemotePaymentProvider {}'), DECLARED), errors: [{ messageId: 'wrongRole' }] },
    { ...at(PUBLISHER, 'export class InvoiceIssuedPublisher {}', DECLARED), errors: [{ messageId: 'undeclared', data: role('publisher', 'application/integration/publishers', 'DomainEventHandler') }] },
    { ...at(INTEGRATION_HANDLER, declaring('DomainEventHandler', "@DomainEventHandler(InvoiceIssued, { name: 'billing.invoice.issued' })\nexport class CatalogProductListedHandler {}"), DECLARED), errors: [{ messageId: 'wrongRole' }] },
    { ...at(POLICY, declaring('Requires', '@Requires(permission)\nexport class OnlyIssuerVoidsPolicy {}'), DECLARED), errors: [{ messageId: 'wrongRole', data: { ...role('policy', 'application/authorization', 'Policy'), className: 'OnlyIssuerVoidsPolicy', actual: 'Requires' } }] },
    { ...at(INTEGRATION_HANDLER, declaring('IntegrationEventHandler', '@IntegrationEventHandler(productListedV1, { consumer: NAME }, [])\nexport class CatalogProductListedHandler {}'), DECLARED), errors: [{ messageId: 'name', data: { decorator: 'IntegrationEventHandler', className: 'CatalogProductListedHandler', key: 'consumer', problem: 'not a string literal', context: 'billing' } }] },
    { ...at(POLICY, declaring('Policy', '@Policy(permission, { name: `billing.${rule}` })\nexport class OnlyIssuerVoidsPolicy {}'), DECLARED), errors: [{ messageId: 'name', data: { decorator: 'Policy', className: 'OnlyIssuerVoidsPolicy', key: 'name', problem: 'not a string literal', context: 'billing' } }] },
    { ...at(POLICY, declaring('Policy', '@Policy(permission)\nexport class OnlyIssuerVoidsPolicy {}'), DECLARED), errors: [{ messageId: 'name', data: { decorator: 'Policy', className: 'OnlyIssuerVoidsPolicy', key: 'name', problem: 'missing', context: 'billing' } }] },
    { ...at(EVENT_HANDLER, declaring('DomainEventHandler', "@DomainEventHandler(InvoiceIssued, { name: '' })\nexport class InvoiceIssuedEventHandler {}"), DECLARED), errors: [{ messageId: 'name', data: { decorator: 'DomainEventHandler', className: 'InvoiceIssuedEventHandler', key: 'name', problem: 'empty', context: 'billing' } }] },
    { ...at(MAPPER, declaring('Policy', 'const inline = @Policy(permission, options) class {};'), DECLARED), errors: [{ messageId: 'name', data: { decorator: 'Policy', className: 'the class', key: 'name', problem: 'not a string literal', context: 'billing' } }] },
    { ...at(EVENT_HANDLER, declaring('DomainEventHandler', `class InvoiceIssued { readonly name = 'billing.invoice.paid'; }\n${ISSUED}`), DECLARED), errors: [{ messageId: 'eventName', data: { className: 'InvoiceIssuedEventHandler', declared: 'billing.invoice.issued', event: 'InvoiceIssued', actual: 'billing.invoice.paid' } }] },
    { ...inProject(PUBLISHER, declaring('DomainEventHandler', `${ISSUED_EVENT.replace('../../', '../../../')}\n@DomainEventHandler(InvoiceIssued, { name: 'billing.invoice.sent' }, [EVENT_PUBLISHER])\nexport class InvoiceIssuedPublisher {}`)), errors: [{ messageId: 'eventName', data: { className: 'InvoiceIssuedPublisher', declared: 'billing.invoice.sent', event: 'InvoiceIssued', actual: 'billing.invoice.issued' } }] },
    { ...inProject(EVENT_HANDLER, declaring('DomainEventHandler', `import { InvoiceIssued as Issued } from '@/contexts/billing/domain/events/invoice-issued.event.js';\n@DomainEventHandler(Issued, { name: 'billing.invoice.sent' })\nexport class InvoiceIssuedEventHandler {}`)), errors: [{ messageId: 'eventName', data: { className: 'InvoiceIssuedEventHandler', declared: 'billing.invoice.sent', event: 'Issued', actual: 'billing.invoice.issued' } }] },
    { ...at(AGGREGATE, declaring('Repository', '@Repository(INVOICES)\nexport class Invoice {}'), DECLARED), errors: [{ messageId: 'inDomain', data: { className: 'Invoice', decorator: 'Repository' } }] },
    { ...at(`${BILLING}/domain/services/numbering.service.ts`, declaring('Adapter as Bound, Policy', "@Bound(NUMBERING)\nclass Numbering {}\n@Policy(p, { name: 'billing.x' })\nexport class Rule {}"), DECLARED), errors: [{ messageId: 'inDomain', data: { className: 'Numbering', decorator: 'Adapter' } }, { messageId: 'inDomain', data: { className: 'Rule', decorator: 'Policy' } }] },
    { ...at(`${BILLING}/domain/events/invoice-issued.event.ts`, `import * as declarations from '${DECLARATIONS}';\n@declarations.DomainEventHandler(InvoiceIssued, { name: NAME })\nexport class InvoiceIssued {}`, DECLARED), errors: [{ messageId: 'inDomain', data: { className: 'InvoiceIssued', decorator: 'DomainEventHandler' } }] },
  ],
});
