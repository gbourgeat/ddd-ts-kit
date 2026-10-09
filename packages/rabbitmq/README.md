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
each consuming context subscribes through the bus under its own name.

```ts
// main.ts
import { SystemClock } from '@ddd-ts-kit/kernel';
import { OutboxPublisher, OutboxRelay, consume, subscribeAll, validatingPublisher } from '@ddd-ts-kit/events';
import { RabbitMqEventBus } from '@ddd-ts-kit/rabbitmq';
import { tracedPublisher, tracedSubscriber } from '@ddd-ts-kit/tracing';

const bus = new RabbitMqEventBus({
  connection: config.amqpUrl, // or amqplib options, or a factory opening a new connection
  exchange: 'integration-events', // the default
  retry: { maxAttempts: 5, delayMs: 5_000 }, // the defaults
  prefetch: 10, // the default
  onFailure: (failure) => logger.warn(failure), // codes only, never an error message
  onDelivery: ({ queue, outcome }) => deliveries.add(1, { queue, outcome }),
});

// Publishing side: handlers write to the outbox, in the transaction of the command.
const publisher = validatingPublisher(new OutboxPublisher(outboxStore), registry);

// The relay target is the bus. A record is marked published when the broker confirmed it.
const relay = new OutboxRelay({ store: outboxStore, publisher: tracedPublisher(bus), clock: new SystemClock() });
relay.start({ intervalMs: 500 });

// Consuming side: one subscriber per consuming context, named after it.
const billingEvents = tracedSubscriber(bus.forConsumer('billing'));
subscribeAll(billingEvents, [
  consume(orderPlaced, { consumer: 'billing.ordering.order.placed', processed, unitOfWork }, async (event) => {
    await commandBus.execute(new IssueInvoice(event.payload.orderId));
  }),
]);

await bus.assertTopology(); // fail at startup, not at the first message

process.on('SIGTERM', async () => {
  await relay.stop(); // the tick in progress finishes
  await bus.close(); // consumers stop, handlers in progress finish and acknowledge
});
```

- `publish(events)` resolves only when the broker confirmed **every** message of the batch and
  rejects otherwise (`PUBLISH_NOT_CONFIRMED`, `BROKER_UNAVAILABLE`, `UNROUTABLE_EVENT`,
  `EVENT_BUS_CLOSED`). Nothing is buffered for later: the outbox is the buffer.
- A consumer name is required to subscribe: `bus.forConsumer('billing')` gives an
  `IntegrationEventSubscriber` for one context on the shared connection (a modular monolith
  has several), and the `consumer` option names the one `bus.subscribe` works for (a service
  that is a single context).
- The tracing wrappers work as with any provider: the bus carries `traceparent` and
  `correlationId` untouched, in the envelope and in the message headers.
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
queue name), so there is one exchange to manage and no binding besides the one above.

A message is the envelope as JSON (`id`, `type`, `version`, `occurredAt`, `payload`,
`traceparent`, `correlationId`), persistent, with the routing key and the `type` property set
to the event type, `messageId` to the event id, `correlationId` to the correlation id, and the
headers `traceparent`, `x-correlation-id` and `x-event-version`. Any AMQP client can consume it.

Two consumers of one type have a queue each and both receive every event. Two instances of
one consumer share its queue: each event goes to one of them.

## Retry and dead-letter behaviour

1. A message is acknowledged after every handler subscribed to its queue resolved. Use
   `consume` of `@ddd-ts-kit/events`: the acknowledgement then follows the commit of the unit
   of work, and a redelivery is deduplicated.
2. When a handler throws, the bus sends a confirmed copy of the message to the retry queue
   with the header `x-attempt` incremented and `x-error-code` set, then acknowledges the
   original. The copy waits `retry.delayMs` there and comes back to the work queue. A failed
   message is never requeued on the spot: no hot loop.
3. At the `retry.maxAttempts`-th failed delivery the copy goes to the dead queue instead, with
   `x-dead-reason: max-attempts`.
4. A message whose body is not an envelope (unparseable, or without `id`, `type`, `version`,
   `occurredAt`) is poison: it goes straight to the dead queue with
   `x-dead-reason: poison` and `x-error-code: POISON_MESSAGE`, and no handler sees it.
5. Only codes travel: `x-error-code` is the `code` of the error or its class name. The message
   of an error is never logged, reported or attached, because it may quote payload data.

Delivery is at least once and unordered. The copy-then-acknowledge order means a crash in
between delivers the message twice, never zero times.

On a lost connection the bus reconnects with an exponential backoff (`reconnect`, 200 ms
doubling up to 30 s), declares its topology again and resumes its consumers. Publications in
flight reject, and so does `publish` between two attempts, so the outbox relay keeps the
records and retries them. Messages that were being handled are redelivered by the broker.

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

Replaying dead messages, once the cause is fixed:

```ts
const replayed = await bus.replayDead({ consumer: 'billing', type: 'ordering.order.placed' }, 100);
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

[docs/other-brokers.md](docs/other-brokers.md) outlines the same provider on Kafka, NATS
JetStream and SQS/SNS, against the same two ports and the same contract suite.

## Testing

The suites need a real broker and are skipped without `DDD_TS_KIT_TEST_AMQP_URL`:

```
docker run -d --rm --name ddd-ts-kit-test-rabbitmq -e RABBITMQ_DEFAULT_USER=kit -e RABBITMQ_DEFAULT_PASS=kit -p 127.0.0.1:5672:5672 rabbitmq:4-management-alpine
DDD_TS_KIT_TEST_AMQP_URL=amqp://kit:kit@127.0.0.1:5672 npx vitest run packages/rabbitmq
docker rm -f ddd-ts-kit-test-rabbitmq
```

They run the contract suite on quorum and on classic queues, then the behaviours of this
provider (confirmations cut mid-flight, retry, dead-lettering, poison, competing and separate
consumers, reconnection through a TCP relay the test cuts, graceful close) and the whole chain
from the outbox to an idempotent consumer. Every test works on an exchange and queues of its
own and deletes them.
