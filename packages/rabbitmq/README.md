**English** · [Français](README.fr.md)

# @ddd-ts-kit/rabbitmq

The integration event provider for RabbitMQ: an `EventBus` of the kernel that publishes with
publisher confirms, so the outbox relay can mark a record published safely, and consumes from
one durable queue per consumer and event type with manual acknowledgement, a bounded number of
delayed retries and a dead queue. It is the "queue brokers" row of the strategy table of
`@ddd-ts-kit/events`, implemented, and it passes `eventBusContract` of `@ddd-ts-kit/testing`.

```
npm i @ddd-ts-kit/rabbitmq @ddd-ts-kit/events amqplib
```

Tested with amqplib 2.2 against RabbitMQ 4.3. Any AMQP 0-9-1 broker with publisher confirms
should work with `queueType: 'classic'`; only RabbitMQ was run.

## Composition root

Handlers never see this package. They publish to the outbox; the relay publishes to RabbitMQ;
each consuming context listens through the bus under its own name. The bus is given to the
application as two ports of the kernel: `IntegrationEventPublisher` stays the outbox, and
`EventSubscribers` hands each context the subscriber of its own consumer name.

![The handler of ordering writes the order and an outbox record in one transaction; the outbox relay gives the record to RabbitMqEventBus, which publishes it to the topic exchange integration-events with the event type as routing key and waits for the confirmation of the broker; the exchange routes a copy to the work queue of each consumer bound for that type, billing.ordering.order.placed and shipping.ordering.order.placed; each queue hands it to the handlers of its context, acknowledged after their unit of work committed](https://raw.githubusercontent.com/gbourgeat/ddd-ts-kit/main/docs/assets/diagrams/rabbitmq-outbox-to-queues.svg)

`init --broker rabbitmq` writes this wiring in the platform of the project: the bus is built by
`platform/events/create-event-provider.ts`, `platform/composition/platform.module.ts` rebinds
`EventSubscribers` on it, and `main.ts` gives it, traced, to the outbox relay. By hand, the
same thing reads:

<!-- checked sample -->
```ts
// platform/messaging.module.ts
import { defineContextModule } from '@ddd-ts-kit/di';
import { EventSubscribers, IntegrationEventPublisher, type Logger, type Metrics } from '@ddd-ts-kit/kernel';
import { OutboxPublisher, OutboxStore } from '@ddd-ts-kit/events';
import { RabbitMqEventBus } from '@ddd-ts-kit/rabbitmq';

declare const config: { readonly amqpUrl: string };
declare const logger: Logger;
declare const metrics: Metrics;

export const bus = new RabbitMqEventBus({
  connection: config.amqpUrl, // or amqplib options, or a factory opening a new connection
  exchange: 'integration-events', // the default
  retry: { maxAttempts: 5, delayMs: 5_000 }, // the defaults
  prefetch: 10, // the default
  onFailure: (failure) => logger.warn('event bus failure', { ...failure }), // codes only, never an error message
  // The label `outcome` of the kernel is success or failure: the four outcomes of a delivery take another name.
  onDelivery: ({ queue, outcome }) => metrics.counter('event_deliveries_total').increment({ queue, status: outcome }),
});

export const messagingModule = defineContextModule({
  name: 'messaging',
  register(builder) {
    // Publishing side: handlers write to the outbox, in the transaction of the command.
    builder.rebind(IntegrationEventPublisher).toClass(OutboxPublisher, [OutboxStore]);
    // Consuming side: one subscriber per consuming context, named after it.
    builder.rebind(EventSubscribers).toValue({ forContext: (name) => bus.forConsumer(name) });
  },
});
```

<!-- checked sample -->
```ts
import { Command, CommandBus, systemActor, type Actor, type IntegrationEvent } from '@ddd-ts-kit/kernel';
import { IntegrationEventHandler } from '@ddd-ts-kit/kernel/declarations';
import { defineIntegrationEvent, type PayloadOf } from '@ddd-ts-kit/events';
import { zodSchema } from '@ddd-ts-kit/validation/zod';
import { z } from 'zod';

// contexts/ordering/published-language: the contract billing listens to.
export const orderPlaced = defineIntegrationEvent({
  type: 'ordering.order.placed',
  version: 1,
  payload: zodSchema(z.object({ orderId: z.string() })),
});

// contexts/billing/application/commands/issue-invoice/issue-invoice.command.ts
export class IssueInvoice extends Command {
  constructor(
    readonly actor: Actor,
    readonly orderId: string,
  ) {
    super();
  }
}

// contexts/billing/application/integration/handlers/invoice-on-order-placed.integration-handler.ts
@IntegrationEventHandler(orderPlaced, { consumer: 'billing.invoice-on-order-placed' })
export class InvoiceOnOrderPlacedIntegrationHandler {
  constructor(private readonly commands: CommandBus) {}

  // Nobody is calling: the handler acts as a system actor named after its consumer.
  readonly actor = systemActor('billing.invoice-on-order-placed');

  async handle(event: IntegrationEvent<PayloadOf<typeof orderPlaced>>): Promise<void> {
    await this.commands.execute(new IssueInvoice(this.actor, event.payload.orderId));
  }
}
```

<!-- checked sample -->
```ts
// main.ts
import { contextModule, kernelModule, type ContextModule, type DeclaredSource } from '@ddd-ts-kit/di';
import { createApplication } from '@ddd-ts-kit/di/tsyringe';
import { Clock } from '@ddd-ts-kit/kernel';
import { OutboxRelay, OutboxStore } from '@ddd-ts-kit/events';
import type { RabbitMqEventBus } from '@ddd-ts-kit/rabbitmq';

// In a project: import { bus, messagingModule } from '@/platform/messaging.module';
declare const bus: RabbitMqEventBus;
declare const messagingModule: ContextModule;
declare const persistenceModule: ContextModule;
declare const orderingDeclarations: DeclaredSource;
declare const billingDeclarations: DeclaredSource;

const app = createApplication({
  modules: [
    kernelModule(),
    persistenceModule,
    messagingModule,
    contextModule('ordering', orderingDeclarations),
    contextModule('billing', billingDeclarations),
  ],
});

// The relay target is the bus. A record is marked published when the broker confirmed it.
const relay = new OutboxRelay({ store: app.resolve(OutboxStore), publisher: bus, clock: app.resolve(Clock) });

await app.start(); // subscribes the handler of billing on bus.forConsumer('billing')
await bus.assertTopology(); // fail at startup, not at the first message
relay.start({ intervalMs: 500 });

process.on('SIGTERM', async () => {
  await relay.stop(); // the tick in progress finishes
  await app.stop(); // the handlers are unsubscribed
  await bus.close(); // consumers stop, handlers in progress finish and acknowledge
});
```

- `persistenceModule` binds `OutboxStore`, and rebinds `UnitOfWork` and `ProcessedEventStore`
  to the database: see the README of the persistence adapter. A declared integration event
  handler is subscribed on the subscriber of its own context (`forContext` receives the name
  of its module), and since `UnitOfWork` and `ProcessedEventStore` are bound, its idempotency
  mark and its work commit in one unit of work: a redelivery is deduplicated, a failure
  leaves nothing behind.
- Without an outbox the bus is the event bus of the kernel module, and handlers publish
  straight to the broker:
  `kernelModule({ eventBus: bus, eventSubscribers: () => ({ forContext: (name) => bus.forConsumer(name) }) })`.
- Without a container the same objects are wired by hand: `bus.forConsumer('billing')` is an
  `IntegrationEventSubscriber`, to give to `subscribeAll` and `consume` of `@ddd-ts-kit/events`.
  A bus built without the `consumer` option has no name to give its queues, so
  `bus.subscribe(...)` throws `ConsumerNameRequiredError`: name the consuming context instead.

<!-- checked sample -->
```ts
import { consume, defineIntegrationEvent, subscribeAll } from '@ddd-ts-kit/events';
import type { ProcessedEventStore, UnitOfWork } from '@ddd-ts-kit/kernel';
import { RabbitMqEventBus } from '@ddd-ts-kit/rabbitmq';
import { zodSchema } from '@ddd-ts-kit/validation/zod';
import { z } from 'zod';

declare const processed: ProcessedEventStore; // the store of the persistence adapter
declare const unitOfWork: UnitOfWork; // the transaction of the database
declare function issueInvoice(orderId: string): Promise<void>;

const orderPlaced = defineIntegrationEvent({
  type: 'ordering.order.placed',
  version: 1,
  payload: zodSchema(z.object({ orderId: z.string() })),
});

const bus = new RabbitMqEventBus({ connection: 'amqp://kit:kit@127.0.0.1:5672' });

// Instead of: bus.subscribe(orderPlaced.type, handler), which throws ConsumerNameRequiredError here.
// Write: the subscriber of one consuming context, whose name its queues carry.
export const billing = subscribeAll(bus.forConsumer('billing'), [
  consume(orderPlaced, { consumer: 'billing.invoice-on-order-placed', processed, unitOfWork }, async (event) => {
    await issueInvoice(event.payload.orderId);
  }),
]);

await bus.assertTopology(); // declares billing.ordering.order.placed and its .retry and .dead, then consumes
```

- `publish(events)` resolves only when the broker confirmed **every** message of the batch and
  rejects otherwise (`PUBLISH_NOT_CONFIRMED`, `BROKER_UNAVAILABLE`, `UNROUTABLE_EVENT`,
  `EVENT_BUS_CLOSED`). Nothing is buffered for later: the outbox is the buffer.
- A consumer name is required to subscribe: `bus.forConsumer('billing')` gives an
  `IntegrationEventSubscriber` for one context on the shared connection (a modular monolith
  has several), and the `consumer` option names the one `bus.subscribe` works for (a service
  that is a single context).
- Tracing is put around both sides from outside, as with any provider: `tracedPublisher(bus)`
  as the relay target, and on the consuming side the instrumentation of the kernel module
  (`kernelModule({ instrumentation: traceApplication() })`), which gives each declared handler
  one span `process <consumer>` per attempt. `tracedSubscriber(bus.forConsumer(name))` is for
  a composition without `kernelModule`. The bus carries `traceparent` and `correlationId`
  untouched, in the envelope and in the message headers.
- The correlation makes the round trip. Publish through `scopedPublisher(publisher, scope)` of
  the kernel: a declared handler (or `consume(definition, { ..., scope }, handler)` by hand)
  runs in an execution context whose `correlationId` is the one of the request that published,
  whose `causationId` is the event, and a redelivery after a failure runs in the same one. An
  operator reads it on the message without opening the body, in the `correlation_id` property
  and the `x-correlation-id` header.
- A context extracted to its own service keeps its consumer name and so its queues: nothing
  changes on the broker.

## Topology

`bus.describeTopology()` returns the exchanges, queues and bindings as data, for a review or
a generated document; `bus.assertTopology()` declares them, idempotently. The bus also declares
them on every (re)connection. For `forConsumer('billing')` subscribed to
`ordering.order.placed`:

| Object | Name | Properties |
|---|---|---|
| exchange | `integration-events` | topic, durable |
| work queue | `billing.ordering.order.placed` | durable, quorum; bound to the exchange with the routing key `ordering.order.placed`; dead-letters to the dead queue |
| retry queue | `billing.ordering.order.placed.retry` | durable, quorum; `x-message-ttl` = `retry.delayMs`; dead-letters back to the work queue, at least once |
| dead queue | `billing.ordering.order.placed.dead` | durable, quorum; no consumer |

Retries and dead letters travel through the default exchange of the broker (routing key =
queue name), so there is one exchange to manage and no binding besides the one above. A quorum
retry queue also takes `x-dead-letter-strategy: at-least-once` and `x-overflow: reject-publish`,
so that an expired retry is not lost on its way back to the work queue.

A message is the envelope as JSON (`id`, `type`, `version`, `occurredAt`, `payload`,
`traceparent`, `correlationId`, `tenantId`), persistent, with the routing key and the `type`
property set to the event type, `messageId` to the event id, `correlationId` to the correlation
id, and the headers `traceparent`, `x-correlation-id`, `x-tenant-id` and `x-event-version`. Any
AMQP client can consume it.

Two consumers of one type have a queue each and both receive every event. Two instances of
one consumer share its queue: each event goes to one of them.

## Retry and dead-letter behaviour

![The three queues of the consumer billing for the type ordering.order.placed: the work queue hands a message to the handlers with its attempt n read from x-attempt; when a handler threw and n is below retry.maxAttempts, the bus sends a confirmed copy to the retry queue with x-attempt n plus 1, then acknowledges the original; the copy waits retry.delayMs, the time to live of the retry queue, and the broker dead-letters it back to the work queue; at n equal to retry.maxAttempts, and at once for a poison message, the copy goes to the dead queue instead; a consumer that keeps crashing is dead-lettered to the dead queue by the broker itself, by the delivery limit of a quorum queue](https://raw.githubusercontent.com/gbourgeat/ddd-ts-kit/main/docs/assets/diagrams/rabbitmq-retry-and-dead-letter.svg)

1. A message is acknowledged after every handler subscribed to its queue resolved. A declared
   `@IntegrationEventHandler` (or `consume` of `@ddd-ts-kit/events` by hand) commits its work
   and its idempotency mark in one unit of work: the acknowledgement then follows that commit,
   and a redelivery is deduplicated.
2. When a handler throws, the bus sends a confirmed copy of the message to the retry queue
   with the header `x-attempt` incremented and `x-error-code` set, then acknowledges the
   original. The copy waits `retry.delayMs` there and comes back to the work queue. A failed
   message is never requeued on the spot: no hot loop.
3. At the `retry.maxAttempts`-th failed delivery the copy goes to the dead queue instead, with
   `x-dead-reason: max-attempts`.
4. A message whose body is not an envelope (unparseable, without `id`, `type`, `version` or
   `occurredAt`, or with a `tenantId` that `isTenantId` of the kernel refuses) is poison: it
   goes straight to the dead queue with `x-dead-reason: poison` and
   `x-error-code: POISON_MESSAGE`, and no handler sees it.
5. Only codes travel: `x-error-code` is the `code` of the error or its class name. The message
   of an error is never logged, reported or attached, because it may quote payload data.

Delivery is at least once and unordered. The copy-then-acknowledge order means a crash in
between delivers the message twice, never zero times.

On a lost connection the bus reconnects with an exponential backoff (`reconnect`, 200 ms
doubling up to 30 s), declares its topology again and resumes its consumers. Publications in
flight reject, and so does `publish` between two attempts, so the outbox relay keeps the
records and retries them. Messages that were being handled are redelivered by the broker.

**Credentials.** The URL or the options of `connection` are held by the function that opens the connection, in no field. A `RabbitMqEventBus` that is logged, spread or
serialised shows `RabbitMqEventBus [connection concealed]` and nothing else: its fields are not enumerable,
and `toJSON` and `util.inspect` answer that name. The failures it reports are codes. What the
client library itself shows when one of its own objects is inspected is not in the hands of
this package: do not log those.

**What a handler is told.** Next to the event, each handler receives the delivery
(`EventDelivery` of the kernel): `{ attempt, maxAttempts, system: 'rabbitmq', destination, consumer }`,
where `destination` is the work queue and `consumer` the consumer name (`billing`). Handlers of the application ignore it; `@ddd-ts-kit/tracing` reads it
to make one CONSUMER span per attempt and to mark the redeliveries and the attempt after which
the event is buried. The bus names itself `messagingSystem: 'rabbitmq'`, and `traceparent` travels in
the envelope and as a real header, intact across a retry.

## Operations

What to watch:

| Signal | Where | Meaning |
|---|---|---|
| outbox `stats()` (`pending`, `failed`, `dead`) | the outbox store | the publishing side: see `@ddd-ts-kit/events` |
| depth of `<consumer>.<type>` | broker | the consumer lags or is stopped |
| depth of `<consumer>.<type>.dead` | broker | must be 0: alert on anything else |
| depth of `<consumer>.<type>.retry` | broker | failures in progress; a plateau means a handler that keeps failing |
| `onDelivery` counted by `outcome` | this bus | rate of `retried`, `dead`, `poison` against `acknowledged` |
| `onFailure` with `kind: 'connection'` | this bus | reconnections, and declarations the broker refused (`AMQP_406`) |
| `bus.deliveriesInFlight` | this bus | handlers running now; stuck above 0 means a handler that hangs |

With an error tracker, `DeadLetterReports` of the kernel turns `onFailure` into reports of the
events given up, and of those only: `onFailure: (failure) => reports.onFailure(failure)`, and
`reports.observing(bus.forConsumer(name))` as the subscriber of each context, so that a report
carries what the handler threw. `init` wires it when the project has one.

Replaying dead messages, once the cause is fixed:

<!-- checked sample -->
```ts
import type { RabbitMqEventBus } from '@ddd-ts-kit/rabbitmq';

declare const bus: RabbitMqEventBus;

// Up to 100 messages of billing.ordering.order.placed.dead, back to the work queue with x-attempt 1.
const replayed = await bus.replayDead({ consumer: 'billing', type: 'ordering.order.placed' }, 100);
console.log(`${String(replayed)} message(s) replayed`);
```

It moves up to that many messages from the dead queue back to the work queue with a fresh
attempt budget, each with a confirmed copy before the acknowledgement. The management UI or
a shovel can move them too; reset or drop the `x-attempt` header if you do, or the message
dies again at its first failure. Look at `x-dead-reason` and `x-error-code` first: replaying
a poison message only kills it again.

To stop a consumer for good, delete its three queues: unsubscribing leaves them bound, and
the work queue keeps filling.

## Limits

- **No ordering.** Retries and competing instances reorder. Carry a version in the payload.
- **One delay.** The retry wait is the TTL of the retry queue: the same for every attempt, no
  exponential backoff.
- **Queue arguments are fixed at creation.** Changing `retry.delayMs` or `queueType` for an
  existing queue is refused by the broker (reported as `AMQP_406` while the bus keeps trying to
  reconnect): delete the queue, or migrate under another consumer name.
- **A redelivery runs every handler of the queue again**, those that succeeded included, when
  several handlers of one consumer subscribe to the same type. Each must be idempotent.
- **A batch is not atomic.** When `publish` rejects, some events of the batch may have been
  taken by the broker. The relay publishes one by one and retries, consumers deduplicate.
- **`onUnroutable: 'fail'`** rejects an event no queue is bound for; behind the outbox relay
  such a record is retried, then dead. Use it only when a missing consumer is an incident.
- **`publishTimeoutMs`** (default 30000): a publication the broker has not confirmed by then is
  rejected with `PUBLISH_NOT_CONFIRMED`, as on NATS and Kafka, so the relay retries it instead of
  waiting for a confirmation that a stalled broker never sends.
- **A consumer that crashes mid-handler** gets its messages back without `x-attempt` being
  incremented. Quorum queues bound that with their delivery limit, after which the message is
  dead-lettered to the dead queue by the broker; classic queues do not bound it. This path is
  the broker's and is not exercised by the test suite.
- **Classic queues** dead-letter the expired retries at most once: a broker crash at that
  instant can lose one. Quorum queues (the default) use the at-least-once strategy.
- **A connection factory must open a new connection at each call**; the bus closes what it
  opened. A connection shared with other code cannot be given.
- Large batches are written without waiting for the socket to drain: memory grows with the
  batch. The relay publishes record by record, which avoids it.
- Queue names are `<consumer>.<type>` plus a suffix, within the 255 bytes of AMQP.

## Other brokers

[`@ddd-ts-kit/kafka`](../kafka/README.md), [`@ddd-ts-kit/nats`](../nats/README.md) and
[`@ddd-ts-kit/redis`](../redis/README.md) (Redis Streams) implement the same two ports and
pass the same contract suite. [docs/other-brokers.md](docs/other-brokers.md) says what every
provider owes, maps the concepts of this one to Kafka and JetStream as those packages do it,
and outlines SQS/SNS, which is not built.

## Testing

Every suite runs in the unit run, without a server: the bus connects to an AMQP broker held in
memory (`test/support/amqp/`), which implements the interfaces of amqplib and keeps what the bus
relies on (topic exchanges and the default one, dead-letter arguments, `x-message-ttl`, publisher
confirms and returns, prefetch, redelivery of what a closed channel had not acknowledged, 406 and
404 refusals). With `DDD_TS_KIT_TEST_AMQP_URL`, the same suites run a second time against a real
broker, which is what keeps the in-memory one honest:

```
docker run -d --rm --name ddd-ts-kit-test-rabbitmq -e RABBITMQ_DEFAULT_USER=kit -e RABBITMQ_DEFAULT_PASS=kit -p 127.0.0.1:5672:5672 rabbitmq:4-management-alpine
DDD_TS_KIT_TEST_AMQP_URL=amqp://kit:kit@127.0.0.1:5672 npx vitest run packages/rabbitmq
docker rm -f ddd-ts-kit-test-rabbitmq
```

The integration job of the CI runs them against a real broker on every pull request that reaches this package,
against RabbitMQ 4.3.6 that `pipeline/github/scripts/start-rabbitmq.sh` starts, its image pinned by digest.

They run the contract suite on quorum and on classic queues, then the behaviours of this
provider, one suite per behaviour (`publishing`, `consuming`, `correlation`, `retries`,
`dead-letters`, `topology`, `connection-loss` through a network the test cuts, a TCP relay in
front of a real broker, `closing`)
and the whole chain from the outbox to an idempotent consumer. Every test works on an exchange and queues of its
own and deletes them.
