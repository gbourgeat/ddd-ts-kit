import type { RuleDoc } from '../model/rule-doc.js';

export const EVENTS_DOCS: Readonly<Record<string, RuleDoc>> = {
  'events/name-format': {
    why: 'Event names are routing keys and part of the public contract. A uniform <context>.<aggregate>.<fact> name tells who owns the event and what happened, and never collides across contexts.',
    bad: `readonly name = 'InvoiceIssued';`,
    good: `readonly name = 'billing.invoice.issued';`,
  },
  'events/defined-in-published-language': {
    why: 'Integration events are the only way two contexts communicate, so their shape is a public contract. One declaration with a payload schema gives the type, validates what is published and consumed, and feeds the generated catalog and AsyncAPI document. An event described by hand, or declared twice, drifts from what is really sent.',
    bad: `// application/integration/publishers/invoice-issued.publisher.ts
const event = { type: 'billing.invoice.issued', version: 1, payload };`,
    good: `// published-language/invoice-issued.v1.integration-event.ts
export const invoiceIssuedV1 = defineIntegrationEvent({
  type: 'billing.invoice.issued', version: 1, payload: zodSchema(z.object({ invoiceId: z.string() })),
});`,
  },
  'events/outbox-required': {
    why: 'Publishing an event and committing the state change it describes must succeed or fail together. A handler that talks to a broker or a bus publishes events of transactions that roll back, and loses events when the broker is down. Written to the outbox in the transaction of the command, the event is relayed afterwards, whatever the transport.',
    bad: `// application/commands/issue-invoice/issue-invoice.handler.ts
import { connect } from 'amqplib';
// ddd-ts-kit.config.json
"stack": { "orm": "drizzle", "events": "in-memory" }`,
    good: `// application/commands/issue-invoice/issue-invoice.handler.ts
constructor(private readonly publisher: IntegrationEventPublisher) {}
// platform/platform.module.ts
eventPublisher: new OutboxPublisher(persistence.outbox),`,
  },
  'events/consumer-idempotent': {
    why: 'Delivery is at least once: a consumer sees the same event again after a retry, a restart or a replay. The processed-event store recognises a redelivery by the pair consumer name and event id, in the transaction of the handler. A consumer without a name, or sharing the name of another, either handles events twice or skips events it never handled. An integration event handler class that carries @IntegrationEventHandler(definition, { consumer }) is named by its declaration and needs no registration; the name is a string literal, and it is unique across declarations and registrations alike.',
    bad: `// billing.module.ts
subscriber.subscribe('catalog.product.listed', (event) => productListedHandler.handle(event));
// application/integration/handlers/product-listed.integration-handler.ts
@IntegrationEventHandler(productListedV1, { consumer: CONSUMER_NAME }, [CommandBus])`,
    good: `// billing.module.ts
builder.on(productListedV1, { consumer: 'billing.product-listed' }).handledBy(ProductListedHandler, [CommandBus]);
// or, wired by hand
consume(productListedV1, { consumer: 'billing.product-listed', processed, unitOfWork }, (event) => productListedHandler.handle(event));
// or declared on the class
@IntegrationEventHandler(productListedV1, { consumer: 'billing.product-listed' }, [CommandBus])
export class ProductListedHandler {}`,
  },
  'domain-events/dispatched-on-save': {
    why: 'Domain events leave with the save. Once a repository method that was handed an aggregate resolves, the events the aggregate recorded are dispatched in order, inside the unit of work of the command, so their handlers and the outbox commit or roll back with the state. A handler that pulls the events and dispatches them itself announces them twice or outside the transaction, and a repository adapter that dispatches mixes persistence with wiring. Reported: a call to pullEvents() in application/ or infrastructure/ of a context, and DomainEventDispatcher imported, listed as a dependency or received by a constructor in application/commands, application/queries and a repository adapter. The module file, the tests, the platform and main.ts are left alone.',
    bad: `// application/commands/issue-invoice/issue-invoice.handler.ts
@CommandHandler(IssueInvoiceCommand, [InvoiceRepository, DomainEventDispatcher])
await this.invoices.save(invoice);
await this.dispatcher.dispatch(invoice.pullEvents());`,
    good: `// application/commands/issue-invoice/issue-invoice.handler.ts
@CommandHandler(IssueInvoiceCommand, [InvoiceRepository])
await this.invoices.save(invoice);
// a removal that announces an event takes the aggregate
await this.invoices.remove(invoice);`,
  },
};
