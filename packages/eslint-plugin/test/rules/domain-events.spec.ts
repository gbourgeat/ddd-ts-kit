import { domainEventsDispatchedOnSave } from '../../src/rules/domain-events-dispatched-on-save.js';
import { at, BILLING, ruleTester, SAMPLE_CONFIG } from '../support/rule-tester.js';

const HANDLER = `${BILLING}/application/commands/issue-invoice/issue-invoice.handler.ts`;
const QUERY_HANDLER = `${BILLING}/application/queries/invoices-issued/invoices-issued.handler.ts`;
const EVENT_HANDLER = `${BILLING}/application/event-handlers/invoice-issued.event-handler.ts`;
const INTEGRATION_HANDLER = `${BILLING}/application/integration/handlers/product-listed.integration-handler.ts`;
const ADAPTER = `${BILLING}/infrastructure/persistence/pg-invoice.repository.ts`;
const MAPPER = `${BILLING}/infrastructure/persistence/invoice.mapper.ts`;
const GATEWAY = `${BILLING}/infrastructure/external/stripe-payment.gateway.ts`;
const AGGREGATE = `${BILLING}/domain/aggregates/invoice.aggregate.ts`;
const MODULE = `${BILLING}/billing.module.ts`;
const SPEC = `${BILLING}/test/unit/issue-invoice.handler.spec.ts`;

const DECLARATIONS = "import { CommandHandler, QueryHandler, Repository } from '@ddd-ts-kit/kernel/declarations';";
const IMPORTED = "import { DomainEventDispatcher } from '@ddd-ts-kit/kernel';";
const SAVED = 'export class IssueInvoiceHandler {\n  async execute(): Promise<string> {\n    await this.invoices.save(invoice);\n\n    return invoice.id;\n  }\n}';
const PULLED = 'for (const event of invoice.pullEvents()) await handle(event);';

const pulled = (place: string) => ({ messageId: 'pulled' as const, data: { place } });
const dispatcher = (how: string, place: string) => ({ messageId: 'dispatcher' as const, data: { how, place } });

ruleTester.run('domain-events-dispatched-on-save', domainEventsDispatchedOnSave, {
  valid: [
    at(HANDLER, `${DECLARATIONS}\n@CommandHandler(IssueInvoice, [InvoiceRepository, Clock])\n${SAVED}`),
    at(ADAPTER, `${DECLARATIONS}\n@Repository(InvoiceRepository, [Database])\nexport class PgInvoiceRepository {\n  async save(invoice: Invoice): Promise<void> {\n    await this.database.insert(invoice);\n  }\n}`),
    at(EVENT_HANDLER, `${IMPORTED}\nexport class InvoiceIssuedEventHandler { constructor(private readonly dispatcher: DomainEventDispatcher) {} }`),
    at(INTEGRATION_HANDLER, IMPORTED),
    at(MAPPER, IMPORTED),
    at(GATEWAY, IMPORTED),
    at(MODULE, `${IMPORTED}\nbuilder.resolve(DomainEventDispatcher).register(InvoiceIssued, handler);\nconst events = invoice.pullEvents();`),
    at(AGGREGATE, 'export class Invoice { drain(): void { this.pullEvents(); } }'),
    at(SPEC, `${IMPORTED}\nexpect(invoice.pullEvents()).toEqual([]);`),
    at(`${BILLING}/application/commands/issue-invoice/issue-invoice.handler.spec.ts`, `${IMPORTED}\nexpect(invoice.pullEvents()).toEqual([]);`),
    at('src/platform/events/dispatching.ts', `${IMPORTED}\nconst events = aggregate.pullEvents();`),
    at('src/main.ts', IMPORTED),
    at('src/apps/billing/main.ts', `${IMPORTED}\naggregate.pullEvents();`),
    at(HANDLER, 'const pullEvents = 1;\npullEvents;\nclass Outbox { pullEvents(): void {} }'),
    at(HANDLER, PULLED, { ...SAMPLE_CONFIG, rules: { 'domain-events/dispatched-on-save': 'off' } }),
    at(HANDLER, `// ddd-ts-kit-disable-next-line domain-events/dispatched-on-save -- ADR-0014: the import of legacy invoices replays their events\n${PULLED}`),
  ],
  invalid: [
    { ...at(HANDLER, PULLED), errors: [pulled('application/commands')] },
    { ...at(EVENT_HANDLER, 'const events = this.invoice?.pullEvents();'), errors: [pulled('application/event-handlers')] },
    { ...at(INTEGRATION_HANDLER, "invoice['pullEvents']();"), errors: [pulled('application/integration')] },
    { ...at(ADAPTER, 'export class PgInvoiceRepository { async save(invoice: Invoice): Promise<void> { await this.dispatch(invoice.pullEvents()); } }'), errors: [pulled('infrastructure/persistence')] },
    { ...at(GATEWAY, PULLED), errors: [pulled('infrastructure/external')] },
    { ...at(HANDLER, IMPORTED), errors: [dispatcher('imported', 'application/commands')] },
    { ...at(QUERY_HANDLER, "import type { Clock, DomainEventDispatcher as Dispatcher } from '@ddd-ts-kit/kernel';"), errors: [dispatcher('imported', 'application/queries')] },
    { ...at(ADAPTER, "import { type DomainEventDispatcher } from '../../../../platform/events.js';"), errors: [dispatcher('imported', 'infrastructure/persistence')] },
    {
      ...at(HANDLER, `${DECLARATIONS}\n@CommandHandler(IssueInvoice, [InvoiceRepository, DomainEventDispatcher])\nexport class IssueInvoiceHandler {\n  constructor(private readonly invoices: InvoiceRepository, private readonly dispatcher: DomainEventDispatcher) {}\n}`),
      errors: [dispatcher('named in a dependency list', 'application/commands'), dispatcher('a constructor parameter', 'application/commands')],
    },
    { ...at(QUERY_HANDLER, `${DECLARATIONS}\n@QueryHandler(InvoicesIssued, [DomainEventDispatcher])\nexport class InvoicesIssuedHandler {}`), errors: [dispatcher('named in a dependency list', 'application/queries')] },
    { ...at(ADAPTER, `${DECLARATIONS}\n@Repository(InvoiceRepository, [Database, DomainEventDispatcher])\nexport class PgInvoiceRepository {\n  constructor(database: Database, dispatcher: kernel.DomainEventDispatcher) {}\n}`), errors: [dispatcher('named in a dependency list', 'infrastructure/persistence'), dispatcher('a constructor parameter', 'infrastructure/persistence')] },
  ],
});
