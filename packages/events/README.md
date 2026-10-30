**English** · [Français](README.fr.md)

# @ddd-ts-kit/events

Integration events between bounded contexts, independent of any broker: typed declarations,
a registry, validated publication and consumption, a transactional outbox, and the AsyncAPI
document and event catalog generated from the declarations.

```
npm i @ddd-ts-kit/events @ddd-ts-kit/validation zod
```

![One integration event through the package: inside the transaction of the command, the aggregate records a domain event, its publisher creates the integration event from its declaration and publishes it to the IntegrationEventPublisher port, bound to the OutboxPublisher, which appends a pending record to the outbox table; after the commit the OutboxRelay claims the record and publishes it to the broker or the in-memory bus, which delivers it at least once to consume in the consuming context, which deduplicates it and runs the handler, here the command IssueInvoice. One declaration feeds the producer, the consumer, the registry, the AsyncAPI document and the catalog](https://raw.githubusercontent.com/gbourgeat/ddd-ts-kit/main/docs/assets/diagrams/events-package-place.svg)

## What is in the package

| Step | What it is for | Exports |
|---|---|---|
| Declare | the contract of one event and version, owned by the producer | `defineIntegrationEvent`, `PayloadOf` |
| Register | every event a system publishes, to validate what goes out and to generate the documents | `createEventRegistry`, `EventRegistry`, `validatingPublisher` |
| Store | write the event in the transaction of the command | `OutboxPublisher`, the `OutboxStore` port, `InMemoryOutboxStore` |
| Relay | publish what was stored, after the commit, with retries | `OutboxRelay`, the `RelaySignal` port, `InMemoryRelaySignal` |
| Consume | typed, validated, deduplicated handling | `consume`, `on`, `subscribeAll` |
| Document | the AsyncAPI document and the event catalog | `generateAsyncApi` (`@ddd-ts-kit/events/asyncapi`), `generateEventCatalog` |

The concepts behind it are in [The transactional outbox](../../docs/concepts/transactional-outbox.md),
[Delivery and idempotency](../../docs/concepts/delivery-and-idempotency.md) and
[Event versioning](../../docs/concepts/event-versioning.md).

## The whole loop in one process

Everything below is in memory, so it runs as it is: one declaration, a consumer, the outbox,
the relay, and a redelivery the consumer absorbs. A real application swaps the in-memory
pieces for its database and its broker; the code of the producer and of the consumer does not
change.

<!-- checked sample -->
```ts
import { z } from 'zod';
import { zodSchema } from '@ddd-ts-kit/validation/zod';
import { InMemoryEventBus, InMemoryProcessedEventStore, InMemoryUnitOfWork, SystemClock } from '@ddd-ts-kit/kernel';
import {
  consume,
  defineIntegrationEvent,
  InMemoryOutboxStore,
  OutboxPublisher,
  OutboxRelay,
  subscribeAll,
} from '@ddd-ts-kit/events';

// 1. The contract, declared once by the producer.
const orderPlaced = defineIntegrationEvent({
  type: 'ordering.order.placed',
  version: 1,
  payload: zodSchema(z.object({ orderId: z.string(), total: z.number().int() })),
});

// 2. A consumer of another context: deduplicated, in one unit of work.
const bus = new InMemoryEventBus();
const invoiced: string[] = [];

subscribeAll(bus, [
  consume(
    orderPlaced,
    {
      consumer: 'billing.invoice-on-order-placed',
      processed: new InMemoryProcessedEventStore(),
      unitOfWork: new InMemoryUnitOfWork(),
    },
    async (event) => {
      invoiced.push(event.payload.orderId); // typed: { orderId: string; total: number }
    },
  ),
]);

// 3. The producer only stores: nothing leaves yet.
const store = new InMemoryOutboxStore();
const event = orderPlaced.create({ orderId: 'order-1', total: 3000 }, { id: 'evt-1', occurredAt: new Date() });

await new OutboxPublisher(store).publish([event]);
console.log(await store.stats()); // { pending: 1, failed: 0, dead: 0 }

// 4. The relay publishes what was stored, then marks it published.
const relay = new OutboxRelay({ store, publisher: bus, clock: new SystemClock() });

console.log(await relay.tick()); // { published: 1, failed: 0 }

// 5. The same event delivered again is absorbed by the consumer.
await bus.publish([event]);
console.log(invoiced); // [ 'order-1' ]
```

The sections below take each step in turn, as a real application writes it.

## Declare

One declaration per event and version, in the producer's `published-language/`. It gives the
payload type, validates what is published and consumed, and feeds the generators.

<!-- checked sample -->
```ts
// contexts/ordering/published-language/order-placed.v1.integration-event.ts
import { z } from 'zod';
import { zodSchema } from '@ddd-ts-kit/validation/zod';
import { defineIntegrationEvent, type PayloadOf } from '@ddd-ts-kit/events';

export const orderPlaced = defineIntegrationEvent({
  type: 'ordering.order.placed', // <context>.<aggregate>.<fact>, kebab-case segments
  version: 1,
  description: 'An order was placed by a customer.',
  payload: zodSchema(
    z.object({
      orderId: z.string().describe('Identifier of the order.'),
      total: z.object({ amount: z.number().int(), currency: z.enum(['EUR', 'USD']) }),
      lines: z.array(z.object({ sku: z.string(), quantity: z.number().int().positive() })),
    }),
  ),
});

export type OrderPlaced = PayloadOf<typeof orderPlaced>;
```

The type is checked when the module loads: three kebab-case segments, `<context>.<aggregate>.<fact>`,
and a positive integer version, or `defineIntegrationEvent` throws `InvalidEventDefinitionError`.
The producer is the first segment of the type unless `producer` names it. The declaration then
answers three questions, one per side:

| Member | Side | What it does |
|---|---|---|
| `create(payload, { id, occurredAt, correlationId?, traceparent? })` | producer | validates the payload and builds the envelope; throws `InvalidEventPayloadError`, because publishing an invalid event is a bug |
| `parse(event)` | consumer | checks type, version and payload and answers a `Result`; never throws |
| `is(event)` | either | a cheap guard on type and version only, for a payload already trusted |

A breaking change is a new declaration with `version: 2`; mark the old one `deprecated: true`
and keep publishing both until the consumers have moved. Instead of changing the payload of
`version: 1` under the feet of its consumers:

<!-- checked sample -->
```ts
// contexts/ordering/published-language/order-placed.v2.integration-event.ts
import { z } from 'zod';
import { zodSchema } from '@ddd-ts-kit/validation/zod';
import { defineIntegrationEvent } from '@ddd-ts-kit/events';

// `amount` renamed `minorUnits`, any ISO currency accepted: a consumer of version 1 would break, so a new version.
export const orderPlacedV2 = defineIntegrationEvent({
  type: 'ordering.order.placed',
  version: 2,
  description: 'An order was placed by a customer.',
  payload: zodSchema(
    z.object({
      orderId: z.string(),
      total: z.object({ minorUnits: z.number().int(), currency: z.string().length(3) }),
    }),
  ),
});

// order-placed.v1.integration-event.ts keeps its payload and gains `deprecated: true`;
// the publisher publishes both versions until no consumer reads version 1.
```

A consumer subscribed to version 1 skips version 2 and the other way round, so both live side
by side. The AsyncAPI document lists both versions on the channel of the type, and the catalog
marks the deprecated one.

### Personal data in a payload

A payload that carries personal data says so, and whose: `personal` names the fields that hold it
and the field that names the data subject, an opaque identifier, never personal data itself.

<!-- checked sample -->
```ts
// contexts/crm/published-language/customer-registered.v1.integration-event.ts
import { z } from 'zod';
import { zodSchema } from '@ddd-ts-kit/validation/zod';
import { defineIntegrationEvent } from '@ddd-ts-kit/events';

export const customerRegisteredV1 = defineIntegrationEvent({
  type: 'crm.customer.registered',
  version: 1,
  payload: zodSchema(z.object({ customerId: z.string(), email: z.email(), address: z.object({ city: z.string() }) })),
  personal: { subject: 'customerId', fields: ['email', 'address.city'] },
});
```

The paths are those of the catalog (`address.city`, `lines[].recipient`). The declaration is
refused when it names no field, names one twice, names its subject as personal, or names a
field the schema documents nothing of: a declaration that lies is worse than none. The catalog
writes under the payload which fields are personal and whose, AsyncAPI extends the message with
`x-personal-data: { subject, fields }`, and the register of personal data reads it. A consumer
that copies one of those fields keeps a copy of the person: it declares it with `personalFields`
next to its mapper, and erases it when the platform announces the erasure of that person.

That announcement is `dataSubjectErasedV1` of `@ddd-ts-kit/kernel`, type
`privacy.data-subject.erased`, payload `{ subjectId, erasedAt }`: the id of the person and nobody else (who asked is in the audit trail),
the event erases nothing by itself and carries nothing to erase. It lives in the kernel, since
the application layer of every context handles it, and it is shaped as a definition of this
package: the registry, the catalog, AsyncAPI, `on` and `consume` take it as any other. A project
generated with `--privacy on` publishes it through the outbox at the end of `privacy:erase`, and
`ddd-ts-kit generate erasure-handler <context>` writes the idempotent handler of a context that
erases its own copy (concept page "Personal data in a generated project").

## Publish through the outbox

A publisher is a handler of a domain event of its own context: it maps the fact to the public
payload and publishes to an `IntegrationEventPublisher`, knowing nothing else. With a
database, that publisher is the `OutboxPublisher`: it only stores. Domain events are dispatched
at the end of the unit of work of the command, before its commit (the `before-commit` phase,
the default), so the integration event commits or rolls back with the business write: the
relay publishes it after the commit, never for a command that rolled back. A publisher is
never declared `phase: 'after-commit'`: the transaction that would hold its outbox row is over.

```ts
// contexts/ordering/application/integration/publishers/order-placed.publisher.ts
import { IdGenerator, IntegrationEventPublisher } from '@ddd-ts-kit/kernel';
import { DomainEventHandler } from '@ddd-ts-kit/kernel/declarations';

@DomainEventHandler(OrderPlacedEvent)
export class OrderPlacedPublisher implements DomainEventHandler<OrderPlacedEvent> {
  constructor(
    private readonly publisher: IntegrationEventPublisher,
    private readonly ids: IdGenerator,
  ) {}

  async handle(event: OrderPlacedEvent): Promise<void> {
    const published = orderPlaced.create(
      { orderId: event.aggregateId, total: event.total, lines: event.lines },
      { id: this.ids.next(), occurredAt: event.occurredAt },
    ); // throws InvalidEventPayloadError: publishing an invalid event is a bug

    await this.publisher.publish([published]);
  }
}
```

The correlation id is not passed by hand: `scopedPublisher` stamps it (see "The execution
context of a consumed event").

The publisher knows the port, never the transport. Instead of talking to a broker from the
handler, which sends the event even when the transaction then rolls back:

```ts
// Reported by events/outbox-required: the event leaves before the commit, or without it.
export class OrderPlacedPublisher {
  constructor(private readonly bus: RabbitMqEventBus) {}
}
```

write to `IntegrationEventPublisher`, as above, and let the composition root decide where it
goes. The rule `events/outbox-required` reports two things. In `domain/` or `application/`, an
import of a broker client, of any event bus (the `EventBus` port of the kernel included), of
`OutboxRelay`, of `OutboxPublisher` or of `OutboxStore`. In `application/integration/publishers/`,
a constructor parameter typed as a bus or a relay (a type whose name ends in `EventBus` or
`Relay`): the sample above is reported this way, import or not.

The composition root binds the store under its port, `OutboxStore`, and hands the outbox to
the kernel module as the publisher handlers use. Ports are abstract classes and the class is
what a module binds and resolves:

```ts
// platform/messaging.module.ts
import { defineContextModule } from '@ddd-ts-kit/di';
import { OutboxStore } from '@ddd-ts-kit/events';

export const messagingModule = defineContextModule({
  name: 'messaging',
  register(builder) {
    // The adapter of your database, or InMemoryOutboxStore in a single process.
    builder.bind(OutboxStore).toClass(SqlOutboxStore, [Database]);
  },
});
```

<!-- checked sample -->
```ts
// main.ts
import { createApplication, kernelModule, type ContextModule } from '@ddd-ts-kit/di';
import { Clock, ExecutionScope, Logger, scopedPublisher, type IntegrationEventPublisher } from '@ddd-ts-kit/kernel';
import {
  createEventRegistry,
  OutboxPublisher,
  OutboxRelay,
  OutboxStore,
  validatingPublisher,
  type AnyIntegrationEventDefinition,
} from '@ddd-ts-kit/events';

// Written elsewhere in the project.
declare const persistenceModule: ContextModule, messagingModule: ContextModule, orderingModule: ContextModule;
declare const orderPlaced: AnyIntegrationEventDefinition, invoiceIssued: AnyIntegrationEventDefinition;
declare const broker: IntegrationEventPublisher; // the real provider: a broker adapter, or the in-memory bus

const registry = createEventRegistry([orderPlaced, invoiceIssued]);

const app = createApplication({
  modules: [
    kernelModule({
      // What handlers publish to: the outbox, behind the registry, with the correlation stamped.
      eventPublisher: (resolve) =>
        scopedPublisher(
          validatingPublisher(new OutboxPublisher(resolve(OutboxStore)), registry, { unknown: 'reject' }),
          resolve(ExecutionScope),
        ),
    }),
    persistenceModule,
    messagingModule,
    orderingModule,
  ],
});
const logger = app.resolve(Logger);

const relay = new OutboxRelay({
  store: app.resolve(OutboxStore),
  publisher: broker,
  clock: app.resolve(Clock),
  maxAttempts: 8,
  onFailure: (failure) => logger.warn('outbox relay failure', { ...failure }), // codes only, never an error message
});
relay.start({ intervalMs: 500 });
process.on('SIGTERM', () => void relay.stop()); // waits for the tick in progress
```

Give the outbox to `kernelModule({ eventPublisher })` rather than rebinding
`IntegrationEventPublisher` in a later module: the `instrumentation` of the kernel module wraps
the publisher it binds, and only that one, so a publisher rebound elsewhere has no
`outbox append` span and stores no `traceparent` with its events.

An adapter `implements OutboxStore` and never extends it: the port has abstract members only.
Without a container the same objects are built by hand:
`new OutboxPublisher(store)`, `new OutboxRelay({ store, publisher: broker, clock })`.

The outbox also carries the purge requests of the HTTP caches (`CacheInvalidation` of the
kernel): the relay publishes through `new PurgingPublisher(purger, broker)`, which hands them to
the `CachePurger` instead of the broker. See "Cache tags and purge after the commit" in the
README of `@ddd-ts-kit/http`.

`relay.tick()` claims a batch, publishes each event, marks it published, or schedules a retry
with an exponential backoff; after `maxAttempts` the record is `dead` until
`store.retryDead(ids, now)`. `store.stats()` gives `{ pending, failed, dead }` for a health
check, `store.purgePublished(before)` keeps the table small, and
`store.erasePersonalFields(subject, events)` erases a person from the records of the events listed,
whatever their status (`personalEventsInOutbox(store, events)` gives it to `eraseDataSubject` as a
copy; a generated project reads the list `ddd-ts-kit docs` writes).

![The life of an outbox record: appended pending by the commit of the command, claimed by the relay when it is due, published then purged; a failed publication leaves it pending until its next attempt, after an exponential backoff; after maxAttempts attempts it is dead until retryDead puts it back pending](https://raw.githubusercontent.com/gbourgeat/ddd-ts-kit/main/docs/assets/diagrams/transactional-outbox-record-lifecycle.svg)

The relay publishes the records of a batch one by one, so one event the provider refuses does
not fail its neighbours. With the defaults (`baseMs: 1000`, `factor: 2`, `maxMs: 300000`,
`maxAttempts: 8`) a record that always fails goes like this:

| Attempt that failed | Next attempt | `onFailure` receives |
|---|---|---|
| 1 | 1 s later | `{ kind: 'publish', eventId, eventType, code, attempts: 1, dead: false }` |
| 2 | 2 s later | `attempts: 2, dead: false` |
| 3 to 7 | 4, 8, 16, 32, then 64 s later | `attempts` from 3 to 7, `dead: false` |
| 8 | none: the record is `dead` | `attempts: 8, dead: true` |

The delay is `min(maxMs, baseMs * factor ** (attempts - 1))`; pass `backoff: { baseMs, factor, maxMs }`
to change it. `code` is the `code` of the error when it is shaped like an identifier, else its
class name: never its message, which may quote the payload, so `onFailure` can be logged as it
is.

**Tracing across the outbox.** The envelope carries `traceparent`, and every outbox store
persists and restores it exactly (the contract suite checks it). With
`kernelModule({ instrumentation: traceApplication(), eventPublisher: outbox })` the context of
the request is stamped when the event is appended, and `new OutboxRelay({ store, publisher: tracedPublisher(broker), clock })`
continues that trace when it publishes later: the relay has no span of its own, and a tick
that publishes nothing makes none. `OutboxPublisher` names itself `messagingSystem: 'outbox'`,
which `validatingPublisher` and `scopedPublisher` pass on. See the README of
`@ddd-ts-kit/tracing`.

Delivery is at least once. **By default ordering is not guaranteed, not even per aggregate**:
a failed event is retried while its successors go out, and several relays may run side by
side. When order matters, carry a sequence or a version in the payload, or ask the relay for
it (below).

### Waking the relay instead of polling fast

A relay can sleep on a long interval and still publish at once, when the store tells it that
something was appended. `wakeOn` takes a `RelaySignal`, a port of one method
(`subscribe(listener): { unsubscribe() }`): PostgreSQL `LISTEN/NOTIFY`, a change stream,
or `InMemoryRelaySignal` in a single process. A module binds it like the store,
`builder.bind(RelaySignal).toClass(PostgresRelaySignal, [Database])`, and the relay takes
`wakeOn: app.resolve(RelaySignal)`.

```ts
const signal = new InMemoryRelaySignal();
const store = new InMemoryOutboxStore({ signal }); // notifies after each append
const relay = new OutboxRelay({ store, publisher: broker, clock, wakeOn: signal });
relay.start({ intervalMs: 30_000 }); // the interval is now only the safety net
```

Bursts are coalesced: one tick runs, at most one more is queued, whatever the number of
notifications. **Polling stays as the safety net**: a signal is a hint, and a notification
missed while the listener reconnects or the process restarts must only delay the publication
until the next interval, never lose it. So keep `intervalMs` at the longest delay you accept
for that case, and never rely on the signal alone. A transactional store must notify after
the commit (PostgreSQL does it by itself: `NOTIFY` is delivered at commit).

### Ordering per key

```ts
const relay = new OutboxRelay({
  store,
  publisher: broker,
  clock,
  ordering: 'per-key',
  keyOf: (event) => (orderPlaced.is(event) ? event.payload.orderId : undefined),
});
```

With `ordering: 'per-key'` a record is never published while an earlier record with the same
key is still pending or failed. The price is head-of-line blocking: one event that cannot be
published holds back every later event of its key (and only of its key) until it goes out or
is dead. Events for which `keyOf` gives `undefined` are not ordered.

![Five records in the outbox, in the order they were appended: A1, A2, B1, A3, B2, where A is the key order-1 and B the key order-2, and the publication of A1 fails. With the default ordering, A2, B1, A3 and B2 are published in the same tick and A1 is retried later, so A2 and A3 overtake A1. With ordering per-key, B1 and B2 are published, A2 and A3 are held with the code OUTBOX_HELD_FOR_ORDER, and once A1 goes out on its retry, A2 then A3 follow in order](https://raw.githubusercontent.com/gbourgeat/ddd-ts-kit/main/docs/assets/diagrams/events-package-per-key-ordering.svg)

What it relies on, and what it does not give:

- **Run a single relay.** The memory of which record blocks which key lives in the relay, not
  in the store: the `OutboxStore` port is unchanged, and `claimBatch` alone cannot tell that an
  earlier record is waiting for its retry. Two relays side by side publish concurrently.
- **A restart forgets it.** If the process restarts while a record is in backoff or leased,
  a later record of the same key that becomes due first is published first, once. Strict
  ordering across restarts needs the key stored with the record and a claim that skips keys
  with an earlier unpublished row: a change of the port and of the table, not done here.
- A record held back is rescheduled with the head of its key and shows in `stats().failed`
  with the code `OUTBOX_HELD_FOR_ORDER`; the claims it spends waiting are not counted as
  delivery attempts by this relay.
- A **dead** record stops blocking its key (`onFailure` reports it with `dead: true`). Set
  `maxAttempts: Infinity` if a key must rather stay blocked than skip an event.
- The broker and the consumer must keep the order too: one partition or one queue with a
  single active consumer per key, and a consumer that does not retry out of order.

An `OutboxStore` leases what it hands out: `claimBatch` hides the claimed records for the
lease of the store, so a relay that dies lets them come back. Adapters are held to
`outboxStoreContract` of `@ddd-ts-kit/testing/contracts`.

## Consume idempotently

With `@ddd-ts-kit/di`, a declared integration event handler is idempotent with nothing to
write: its idempotency mark and its work run in one unit of work whenever a `UnitOfWork` and a
`ProcessedEventStore` are bound, which `kernelModule()` does. The composition root builds no
handler by hand:

```ts
// contexts/billing/application/integration/handlers/invoice-on-order-placed.integration-handler.ts
import { CommandBus, type IntegrationEvent } from '@ddd-ts-kit/kernel';
import { IntegrationEventHandler } from '@ddd-ts-kit/kernel/declarations';
import { orderPlaced, type OrderPlaced } from '@/contexts/ordering/published-language';

@IntegrationEventHandler(orderPlaced, { consumer: 'billing.invoice-on-order-placed' })
export class InvoiceOnOrderPlaced {
  constructor(private readonly commands: CommandBus) {}

  async handle(event: IntegrationEvent<OrderPlaced>): Promise<void> {
    await this.commands.execute(new IssueInvoice(event.payload.orderId, event.payload.total));
  }
}
```

`consume` is the tool of a project that wires without di. Instead of subscribing a plain
callback, which handles a redelivered event a second time and issues a second invoice:

```ts
// Reported by events/consumer-idempotent in application/ and in the module file:
// no consumer name, no processed-event store, and a payload neither typed nor validated.
subscriber.subscribe(orderPlaced.type, async (event) => {
  const { orderId, total } = event.payload as OrderPlaced;
  await commandBus.execute(new IssueInvoice(orderId, total));
});
```

give the same semantics as the declared handler to a plain function:

```ts
// contexts/billing/billing.subscriptions.ts
import { consume, subscribeAll } from '@ddd-ts-kit/events';

export const billingSubscriptions = ({ commandBus, processed, unitOfWork }: BillingDependencies) => [
  consume(orderPlaced, { consumer: 'billing.invoice-on-order-placed', processed, unitOfWork }, async (event) => {
    await commandBus.execute(new IssueInvoice(event.payload.orderId, event.payload.total));
  }),
];

// main.ts
const subscription = subscribeAll(subscriber, billingSubscriptions(dependencies));
```

The handler receives a typed, validated event. An event of another version of the same type
is skipped (subscribe to it with its own declaration); an invalid payload throws, so the
provider retries or dead-letters.

`consume` runs the deduplication and the handler in **one unit of work**: the mark in the
processed-event store and the state change of the consumer commit together. A redelivery is
handled once per consumer, and an event whose handler threw is handled again when it comes
back, because its mark was rolled back with the rest. The command bus middleware joins that
unit of work (a nested `run` joins the outer transaction), so the handler needs nothing
special.

![One delivery through consume: the declaration parses the event; another type or version is skipped without a mark; an invalid payload throws InvalidEventPayloadError, so the provider retries or dead-letters it. A valid event enters one unit of work, inside the execution scope when one is given: the processed-event store marks the pair of the consumer and the event id; when the pair was already marked, the handler is skipped; otherwise the handler runs, and its success commits the mark with the state change, while its failure rolls both back, so the redelivery is handled](https://raw.githubusercontent.com/gbourgeat/ddd-ts-kit/main/docs/assets/diagrams/events-package-consume.svg)

The consumer name is the idempotency scope: two consumers of the same event each handle it
once, and renaming a consumer makes it handle again every event it is redelivered. Write it
once, as `<context>.<reaction>`, and never derive it.

`on(definition, handler, { consumer, processed, unitOfWork })` is the same thing with
optional parts, for a consumer that needs no deduplication or has no transaction. Mind one
case: with `processed` and no `unitOfWork`, the mark is taken before the handler runs. If the
handler then fails, a transactional store keeps the mark (it was committed on its own) and the
redelivery is skipped: the event is lost for that consumer. Without a database, use a store
that can take its mark back, a `ReleasableProcessedEventStore` such as the
`InMemoryProcessedEventStore` of the kernel: `on` and `consume` release the mark of a handler
that failed. `ReleasableProcessedEventStore` is a type, not a port of its own: it is the
`ProcessedEventStore` port of the kernel with its optional `release` made mandatory, and such
a store is bound under `ProcessedEventStore`.

### The execution context of a consumed event

`consume` and `on` take the `ExecutionScope` of the kernel and run everything, the unit of
work and the idempotency mark included, inside it:

```ts
consume(orderPlaced, { consumer: 'billing.invoice-on-order-placed', processed, unitOfWork, scope }, handler);
```

| Field of the context | Value |
|---|---|
| `origin` | `event` |
| `correlationId` | the `correlationId` of the event, or its `id` when it names none |
| `causationId` | the `id` of the event |
| `actor` | `systemActor(consumer)`, unless `actorOf(event)` answers one |
| `tenantId` | the `tenantId` of the event, when it names one: the consumer reads and writes in that tenant only |

So the repositories of the consuming context stamp audit columns with
`system:billing.invoice-on-order-placed`, and a log line of the consumer carries the correlation
of the request that started it all. The envelope carries no actor by default, on purpose: an
actor is personal data, and a broker keeps messages. A project that decides to put a reference
in its own payload or envelope maps it with `actorOf: (event) => Actor | undefined`.

On the publishing side, `scopedPublisher` of the kernel fills the correlation in, and the
tenant of the work in progress, so use cases never pass them by hand. It is the outer wrapper
of the publisher given to `kernelModule` in `main.ts` above:

```ts
eventPublisher: (resolve) => scopedPublisher(new OutboxPublisher(resolve(OutboxStore)), resolve(ExecutionScope)),
```

An event created with a `correlationId` or a `tenantId` keeps it; one published outside of any
execution context is left as it is. It is a decorator, not an option of `OutboxPublisher` or of
`defineIntegrationEvent(...).create`: both stay pure, and the stamp applies to every provider.

## Generate the AsyncAPI document and the catalog

<!-- checked sample -->
```ts
// scripts/generate-contracts.ts
import { readFile, writeFile } from 'node:fs/promises';
import { generateEventCatalog, type EventRegistry } from '@ddd-ts-kit/events';
import { checkAsyncApiDrift, generateAsyncApi, stringifyAsyncApi } from '@ddd-ts-kit/events/asyncapi';

declare const registry: EventRegistry; // createEventRegistry([...every published declaration])

const document = generateAsyncApi({
  info: { title: 'Shop events', version: '1.4.0' },
  registry,
  servers: { production: { host: 'broker.example.com:5671', protocol: 'amqps' } },
});
await writeFile('docs/integration/asyncapi.json', stringifyAsyncApi(document));
await writeFile(
  'docs/integration/event-catalog.md',
  generateEventCatalog(registry, { consumers: { 'ordering.order.placed': ['billing', 'shipping'] } }),
);

// In CI: fail when the committed file is stale.
if (checkAsyncApiDrift(document, await readFile('docs/integration/asyncapi.json', 'utf8')).drift) {
  process.exit(1);
}
```

`stringifyAsyncApi` writes two-space JSON. A project generated by the CLI commits
`docs/integration/asyncapi.yaml` instead, written by `stringifyContract(document, 'yaml')` of
`ddd-ts-kit/dist/contracts.js` in its `scripts/events.ts` (`openapi.format: json` of its config
keeps JSON).

The AsyncAPI 3.0.0 document has one channel per event type (its address is the type), one
message per version whose payload is the envelope (`id`, `type`, `version`, `occurredAt`,
`payload`, `traceparent`, `correlationId`), and one `send` operation per channel. The catalog
is Markdown: one section per producer, a table of versions per event, and the payload fields
flattened (`customer.email`, `lines[].sku`). Both outputs depend only on the declarations,
never on their registration order, so they can be committed and diffed. A declaration with
`personal` adds a line under its payload in the catalog and `x-personal-data` to its message.
A project generated by the CLI has this script as `scripts/events.ts`, with the same two
paths.

## Choosing the strategy for your transport

The rule is one, whatever the tools: the handler writes the event to the outbox in the
transaction of the command, a relay publishes it afterwards, the consumer deduplicates. What
changes with the transport is how the relay runs and what the consumer side must do.

| Transport | Relay | Consumer side |
|---|---|---|
| same process, no broker | polling relay to the in-memory bus (or woken by the database: PostgreSQL `LISTEN/NOTIFY`) | processed-event store in the consumer's transaction |
| RabbitMQ and other queue brokers | polling relay publishing with publisher confirms, mark published on confirm | durable queue per consumer, manual ack after commit, dead-letter exchange after bounded retries |
| Kafka and other logs | polling relay, or change data capture reading the outbox table (Debezium outbox router); key = aggregate id for per-aggregate order | consumer group per consumer, offset committed after the handler's transaction, processed-event store for redelivery |
| cloud queues and topics (SQS/SNS, Pub/Sub) | polling relay, batch publish | visibility timeout above the handler's worst case, redrive policy to a dead-letter queue |

Without a database there is nothing to be atomic with: publish to the bus directly, no outbox.

The kit has a provider package for RabbitMQ (`@ddd-ts-kit/rabbitmq`), Kafka
(`@ddd-ts-kit/kafka`), NATS JetStream (`@ddd-ts-kit/nats`) and Redis Streams
(`@ddd-ts-kit/redis/event-bus`); each README says how it meets the requirements below and what it does
not guarantee.

### Same process, no broker

- **Relay mode.** `OutboxRelay` publishing to the `InMemoryEventBus`. Wake it with `wakeOn`
  (the in-memory signal, or `LISTEN/NOTIFY` on PostgreSQL) and keep a long interval as the
  safety net.
- **Publisher requirements.** None beyond the port. The in-memory bus runs the handlers inside
  `publish` and rejects when one fails, with an `AggregateError` by default; built with
  `{ failures: 'as-thrown' }`, it rejects with the error of a single failed handler as it is,
  and the relay stores its `code` (`CONCURRENCY_CONFLICT`) as `lastErrorCode`. The relay then
  retries the record, so the retry policy of the consumers IS the backoff of the relay.
- **Consumer requirements.** `consume` with the processed-event store and the unit of work of
  the consuming context. A redelivery runs every handler of the type again, so every one of
  them deduplicates.
- **Ordering.** `per-key` gives it here with nothing else to set up: one relay, one process,
  handlers awaited in order (the restart caveat of the relay still applies).
- **Dead-lettering.** The outbox is the dead-letter store: a record is `dead` after
  `maxAttempts`, and comes back with `store.retryDead(ids, now)`.
- **Monitor.** `stats()`: `dead > 0` is an alert; `failed` rising means a consumer keeps
  failing; the age of the oldest pending record is the delivery delay.

### Queue brokers (RabbitMQ, ActiveMQ)

- **Relay mode.** Polling or woken relay. The record is marked published only when the broker
  confirmed it.
- **Publisher requirements.** `publish` must resolve only on the confirmation of the broker
  (publisher confirms) and reject otherwise, with durable exchanges and persistent messages.
  A confirmation lost after the broker took the message makes the relay publish it again:
  duplicates are expected. `@ddd-ts-kit/rabbitmq` implements this row.
- **Consumer requirements.** One durable queue per consumer and event type, manual
  acknowledgement after the unit of work of the handler committed, `consume` for the
  deduplication. Never acknowledge before the commit.
- **Ordering.** None by default: retries and competing consumers reorder. Per key only with
  the `per-key` relay AND a single active consumer on the queue AND no retry queue, which is
  rarely worth it; prefer a version in the payload.
- **Dead-lettering.** Two places. Publishing side: the outbox (`dead`, `retryDead`).
  Consuming side: a bounded number of delayed retries, then a dead queue per consumer queue.
- **Monitor.** Outbox `stats()`, and on the broker the depth of each work queue (a consumer
  that lags), of each dead queue (must be empty) and the unacknowledged count.

### Logs (Kafka, Redpanda, Pulsar, Kinesis)

- **Relay mode.** Polling relay, or change data capture (below).
- **Publisher requirements.** Idempotent producer with `acks=all`; `publish` resolves on the
  acknowledgement of the write. The message key is the aggregate id, so one aggregate lives in
  one partition. Topic per event type or per context, chosen once.
- **Consumer requirements.** One consumer group per consuming context. The offset is committed
  after the transaction of the handler, never before; a crash in between redelivers, hence
  the processed-event store. A handler that keeps failing blocks its partition: retry in
  place a bounded number of times, then publish the record to a dead-letter topic and commit.
- **Ordering.** Per partition, so per key, provided the relay keeps it: `ordering: 'per-key'`
  with `keyOf` returning the same aggregate id, a single relay, and
  `max.in.flight.requests.per.connection` at most 5 with idempotence on.
- **Dead-lettering.** Outbox on the publishing side, a dead-letter topic per consumer group on
  the consuming side.
- **Monitor.** Outbox `stats()`, consumer lag per group and partition, dead-letter topic size.

### Cloud queues and topics (SQS/SNS, Pub/Sub)

- **Relay mode.** Polling relay. Batch publication (10 entries per call on SQS and SNS) is
  allowed, but the result is per entry: publish, then reject if any entry failed, so the relay
  retries; the entries that did pass are published twice, which the consumer absorbs.
- **Publisher requirements.** Topic with one subscription (queue) per consumer. `publish`
  resolves on the service acknowledgement. Message attributes carry type, version and trace.
- **Consumer requirements.** Visibility timeout (ack deadline) above the worst case of the
  handler, extended while it runs if needed; delete (ack) the message after the commit.
  `consume` for the deduplication: these services redeliver by design.
- **Ordering.** None on standard queues. FIFO queues and ordering keys give it per message
  group, at a throughput cost, with the `per-key` relay and the group id = `keyOf`.
- **Dead-lettering.** Outbox on the publishing side; a redrive policy (`maxReceiveCount`) to a
  dead-letter queue per consumer queue.
- **Monitor.** Outbox `stats()`, age of the oldest message per queue, dead-letter queue depth.

### What to monitor on the outbox

`store.stats()` gives `{ pending, failed, dead }`; expose them as gauges.

| Signal | Meaning | Reaction |
|---|---|---|
| `dead > 0` | records gave up after `maxAttempts` | alert; fix the cause, then `retryDead` |
| `failed > 0` for long | the provider refuses or is down; under `per-key`, held records count here too (`OUTBOX_HELD_FOR_ORDER`) | look at the codes given to `onFailure` |
| `pending` growing | the relay is slower than the producers, or stopped | check that it runs; raise `batchSize` |
| age of the oldest pending record | the real delivery delay | alert above your tolerance; it is one query on the table (`min(created_at) where status = 'pending'`), `stats()` does not carry it |
| `onFailure({ kind: 'tick' })` | the store itself failed | database health |

Purge published records regularly (`purgePublished(before)`), or the table and its index grow
without bound. A generated project does it every night (`events.purge-published`,
`OUTBOX_RETENTION_DAYS`).

### Where change data capture fits

Change data capture (Debezium and its outbox event router, or a logical replication reader)
replaces **the relay, never the table**. Handlers still write the event to the outbox table
in the transaction of the command; instead of a process polling that table, the capture
reads the same rows from the transaction log of the database and publishes them, in commit
order. Consequences:

- nothing changes in the handlers, in `OutboxPublisher` or in the consumers;
- do not run an `OutboxRelay` on the same table for the same destination: one or the other;
- `status`, `attempts` and `next_attempt_at` are no longer maintained: retries and failures
  are those of the connector, so monitor the connector (lag, failed tasks) instead of
  `stats()`, and purge by age;
- the event router must map the columns: `id` to the message id, `type` to the topic or
  routing key, the aggregate id to the message key, `payload` and the trace columns to the
  body and headers, so the consumer receives the same envelope as from the relay;
- ordering per key comes for free (the log is ordered), which is the main reason to choose it.

Writing to the broker from the handler and "capturing" the business tables instead is not
this pattern: it publishes rows, not events, and couples consumers to the schema.
