import type { RuleDoc } from '../model/rule-doc';

export const EVENTS_DOCS: Readonly<Record<string, RuleDoc>> = {
  'events/name-format': {
    why: 'Event names are routing keys and part of the public contract. A uniform <context>.<aggregate>.<fact> name tells who owns the event and what happened, and never collides across contexts.',
    bad: `static readonly eventName = 'InvoiceIssued';`,
    good: `static readonly eventName = 'billing.invoice.issued';`,
  },
  'events/name-declared-once': {
    why: 'A domain event handler and a projection are attached under the name the event class declares, static readonly eventName: the compiler refuses a reaction to an event class without it. Checked on every domain event, a missing name is found when the event is written, not later when someone first reacts to it. A name written a second time, as a literal in readonly name, drifts from the one the reactions read: extend NamedDomainEvent and the instance name reads the static one.',
    bad: `export class InvoiceIssued implements DomainEvent {
  readonly name = 'billing.invoice.issued';
}`,
    good: `export class InvoiceIssued extends NamedDomainEvent('billing.invoice.issued') {
}`,
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
// platform/composition/platform.module.ts
eventPublisher: new OutboxPublisher(persistence.outbox),`,
  },
  'events/consumer-idempotent': {
    why: "Delivery is at least once: a consumer sees the same event again after a retry, a restart or a replay. The processed-event store recognises a redelivery by the pair consumer name and event id, in the transaction of the handler. A consumer without a name, or sharing the name of another, either handles events twice or skips events it never handled. An integration event handler class that carries @IntegrationEventHandler(definition, { consumer }) is named by its declaration and needs no registration; the name is a string literal, and it is unique across declarations and registrations alike. Options that spread a shared object ({ ...options, consumer: 'ctx.name' }) are accepted when the file shows that object carrying `processed`: a `const` initialised with an object literal, or a value typed `ConsumeOptions`; a spread whose content is not in the file is refused.",
    bad: `// billing.module.ts
subscriber.subscribe('catalog.product.listed', (event) => productListedHandler.handle(event));
// application/integration/handlers/product-listed.integration-handler.ts
@IntegrationEventHandler(productListedV1, { consumer: CONSUMER_NAME })`,
    good: `// billing.module.ts
builder.on(productListedV1, { consumer: 'billing.product-listed' }).handledBy(ProductListedHandler, [CommandBus]);
// or, wired by hand
consume(productListedV1, { consumer: 'billing.product-listed', processed, unitOfWork }, (event) => productListedHandler.handle(event));
// or declared on the class
@IntegrationEventHandler(productListedV1, { consumer: 'billing.product-listed' })
export class ProductListedHandler {
  constructor(private readonly commands: CommandBus) {}
}`,
  },
  'domain-events/dispatched-on-save': {
    why: 'Domain events leave with the save. Once a repository method that was handed an aggregate resolves, the events the aggregate recorded are dispatched in order, inside the unit of work of the command, so their handlers and the outbox commit or roll back with the state. A handler that pulls the events and dispatches them itself announces them twice or outside the transaction, and a repository adapter that dispatches mixes persistence with wiring. Reported: a call to pullEvents() in application/ or infrastructure/ of a context, and DomainEventDispatcher imported, listed as a dependency or received by a constructor in application/commands, application/queries and a repository adapter. The module file, the tests, the platform and main.ts are left alone.',
    bad: `// application/commands/issue-invoice/issue-invoice.handler.ts
@CommandHandler(IssueInvoiceCommand)
constructor(private readonly invoices: InvoiceRepository, private readonly dispatcher: DomainEventDispatcher) {}
await this.invoices.save(invoice);
await this.dispatcher.dispatch(invoice.pullEvents());`,
    good: `// application/commands/issue-invoice/issue-invoice.handler.ts
@CommandHandler(IssueInvoiceCommand)
constructor(private readonly invoices: InvoiceRepository) {}
await this.invoices.save(invoice);
// a removal that announces an event takes the aggregate
await this.invoices.remove(invoice);`,
  },
  'domain-events/transactional-before-commit': {
    why: "An effect of a domain event exists only if the state change that recorded the event is committed. A handler that runs before the commit runs inside the transaction, and the commit can still fail after it ran (a deferred constraint, a serialization failure, a lost connection): that is safe only when the rollback undoes everything the handler did, so a before-commit handler has transactional effects only. Judged: every production class of application/event-handlers/*.event-handler.ts and application/integration/publishers/*.publisher.ts, and any class carrying @DomainEventHandler. Its phase is after-commit when its decorator says phase: 'after-commit', or, without a decorator, when every .on(..) of <context>.module.ts whose callback mentions it has a third argument holding phase: 'after-commit'; otherwise it is before-commit. Its dependencies are the names of its dependency list, of .toClass(Handler, [..]) and the types of its constructor parameters, resolved through the imports. Before the commit it may depend on the domain/ of its context, on the kernel ports except Cache, CachePurger, Lock, RateLimiter, JobScheduler and EventBus (CacheInvalidation is allowed: the purge it asks for commits with the work), on @ddd-ts-kit/auth, on application helpers of its context, and on a port of application/ports/ only when it is a persistence port: at least one production class implements it under infrastructure/persistence/ and none anywhere else under infrastructure/. Refused: those five kernel ports, any other port of application/ports/, anything of infrastructure/, of another context, of the platform or of another package. An after-commit handler is refused IntegrationEventPublisher alone: after the commit nothing makes the outbox row atomic with a state change, so it sends a command instead.",
    bad: `// application/event-handlers/invoice-issued.event-handler.ts
// Mailer is implemented under infrastructure/external/: the mail leaves even when the commit fails
@DomainEventHandler(InvoiceIssued)
constructor(
  private readonly invoiceRepository: InvoiceRepository,
  private readonly mailer: Mailer,
  private readonly cache: Cache,
) {}
// after the commit the outbox row would be written in no transaction
@DomainEventHandler(InvoiceIssued, { phase: 'after-commit' })
constructor(private readonly integrationEventPublisher: IntegrationEventPublisher) {}`,
    good: `// application/event-handlers/invoice-issued.event-handler.ts: repositories, persistence ports, buses
@DomainEventHandler(InvoiceIssued)
constructor(
  private readonly invoiceRepository: InvoiceRepository,
  private readonly commandBus: CommandBus,
) {}
// an effect that may be lost on a crash runs after the commit, at most once
@DomainEventHandler(InvoiceIssued, { phase: 'after-commit' })
constructor(private readonly cache: Cache) {}
// explicit style, in billing.module.ts
platform.domainEvents.on('billing.invoice.issued', async (event) => {
  if (event instanceof InvoiceIssued) {
    await invoiceIssuedEventHandler.handle(event);
  }
}, { phase: 'after-commit' });
// an effect that must not be lost: a publisher writes to the outbox, the handler of that event does the work
@DomainEventHandler(InvoiceIssued)
export class InvoiceIssuedPublisher {
  constructor(
    private readonly integrationEventPublisher: IntegrationEventPublisher,
    private readonly idGenerator: IdGenerator,
  ) {}
}`,
  },
};
