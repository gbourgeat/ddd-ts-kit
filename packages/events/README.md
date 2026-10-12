# @ddd-ts-kit/events

Integration events between bounded contexts, independent of any broker: typed declarations,
a registry, validated publication and consumption, a transactional outbox, and the AsyncAPI
document and event catalog generated from the declarations.

```
npm i @ddd-ts-kit/events @ddd-ts-kit/validation zod
```

## Declare

One declaration per event and version, in the producer's `published-language/`. It gives the
payload type, validates what is published and consumed, and feeds the generators.

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

A breaking change is a new declaration with `version: 2`; mark the old one `deprecated: true`
and keep publishing both until the consumers have moved.

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

@DomainEventHandler(OrderPlacedEvent, { name: 'ordering.order.placed' }, [IntegrationEventPublisher, IdGenerator])
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

The composition root binds the store under its port, `OutboxStore`, and replaces the
publisher of the kernel by the outbox. Ports are abstract classes and the class is what a
module binds and resolves:

```ts
// platform/messaging.module.ts
import { defineContextModule } from '@ddd-ts-kit/di';
import { IntegrationEventPublisher } from '@ddd-ts-kit/kernel';
import { createEventRegistry, OutboxPublisher, OutboxStore, validatingPublisher } from '@ddd-ts-kit/events';

const registry = createEventRegistry([orderPlaced, invoiceIssued]);

export const messagingModule = defineContextModule({
  name: 'messaging',
  register(builder) {
    // The adapter of your database, or InMemoryOutboxStore in a single process.
    builder.bind(OutboxStore).toClass(SqlOutboxStore, [Database]);
    builder
      .rebind(IntegrationEventPublisher)
      .toFactory((resolve) =>
        validatingPublisher(new OutboxPublisher(resolve(OutboxStore)), registry, { unknown: 'reject' }),
      );
  },
});
```

```ts
// main.ts
import { createApplication, kernelModule } from '@ddd-ts-kit/di';
import { Clock, Logger } from '@ddd-ts-kit/kernel';
import { OutboxRelay, OutboxStore } from '@ddd-ts-kit/events';

const app = createApplication({ modules: [kernelModule(), persistenceModule, messagingModule, orderingModule] });
const logger = app.resolve(Logger);

const relay = new OutboxRelay({
  store: app.resolve(OutboxStore),
  publisher: broker, // the real provider: any IntegrationEventPublisher
  clock: app.resolve(Clock),
  maxAttempts: 8,
  onFailure: (failure) => logger.warn('outbox relay failure', { ...failure }), // codes only, never an error message
});
relay.start({ intervalMs: 500 });
process.on('SIGTERM', () => void relay.stop()); // waits for the tick in progress
```

An adapter `implements OutboxStore` and never extends it: the port has abstract members only.
Without a container the same objects are built by hand:
`new OutboxPublisher(store)`, `new OutboxRelay({ store, publisher: broker, clock })`.

`relay.tick()` claims a batch, publishes each event, marks it published, or schedules a retry
with an exponential backoff; after `maxAttempts` the record is `dead` until
`store.retryDead(ids, now)`. `store.stats()` gives `{ pending, failed, dead }` for a health
check, `store.purgePublished(before)` keeps the table small.

**Tracing across the outbox.** The envelope carries `traceparent`, and every outbox store
persists and restores it exactly (the contract suite checks it). With
`kernelModule({ instrumentation: traceApplication() })` the context of the request is stamped
when the event is appended, and `new OutboxRelay({ store, publisher: tracedPublisher(broker), clock })`
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
import { orderPlaced, type OrderPlaced } from '@/contexts/ordering/published-language/index';

@IntegrationEventHandler(orderPlaced, { consumer: 'billing.invoice-on-order-placed' }, [CommandBus])
export class InvoiceOnOrderPlaced {
  constructor(private readonly commands: CommandBus) {}

  async handle(event: IntegrationEvent<OrderPlaced>): Promise<void> {
    await this.commands.execute(new IssueInvoice(event.payload.orderId, event.payload.total));
  }
}
```

`consume` is the tool of a project that wires without di. It gives the same semantics to a
plain function:

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

So the repositories of the consuming context stamp audit columns with
`system:billing.invoice-on-order-placed`, and a log line of the consumer carries the correlation
of the request that started it all. The envelope carries no actor by default, on purpose: an
actor is personal data, and a broker keeps messages. A project that decides to put a reference
in its own payload or envelope maps it with `actorOf: (event) => Actor | undefined`.

On the publishing side, `scopedPublisher` of the kernel fills the correlation in, so use cases
never pass it by hand:

```ts
import { ExecutionScope, IntegrationEventPublisher, scopedPublisher } from '@ddd-ts-kit/kernel';

builder
  .rebind(IntegrationEventPublisher) // what handlers publish to
  .toFactory((resolve) => scopedPublisher(new OutboxPublisher(resolve(OutboxStore)), resolve(ExecutionScope)));
```

An event created with a `correlationId` keeps it; one published outside of any execution
context is left as it is. It is a decorator, not an option of `OutboxPublisher` or of
`defineIntegrationEvent(...).create`: both stay pure, and the stamp applies to every provider.

## Generate the AsyncAPI document and the catalog

```ts
// scripts/generate-contracts.ts
import { generateEventCatalog } from '@ddd-ts-kit/events';
import { checkAsyncApiDrift, generateAsyncApi, stringifyAsyncApi } from '@ddd-ts-kit/events/asyncapi';

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

The AsyncAPI 3.0.0 document has one channel per event type (its address is the type), one
message per version whose payload is the envelope (`id`, `type`, `version`, `occurredAt`,
`payload`, `traceparent`, `correlationId`), and one `send` operation per channel. The catalog
is Markdown: one section per producer, a table of versions per event, and the payload fields
flattened (`customer.email`, `lines[].sku`). Both outputs depend only on the declarations,
never on their registration order, so they can be committed and diffed.
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
  `publish` and rejects when one fails: the relay then retries the record, so the retry
  policy of the consumers IS the backoff of the relay.
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
without bound.

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
