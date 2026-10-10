# @ddd-ts-kit/nats

The integration event provider for NATS JetStream: an `EventBus` of the kernel that publishes
to a stream and waits for its acknowledgement, with the event id as message id so the stream
drops a relay retry, and consumes from one durable pull consumer per consumer and event type
with explicit acknowledgement, a bounded number of delayed redeliveries and a dead-letter
stream. It is the JetStream equivalent of the "queue brokers" row of the strategy table of
`docs/ARCHITECTURE.md`, and it passes `eventBusContract` of `@ddd-ts-kit/testing`.

```
npm i @ddd-ts-kit/nats @ddd-ts-kit/events @nats-io/transport-node @nats-io/jetstream
```

Tested with `@nats-io/transport-node` and `@nats-io/jetstream` 3.4 against NATS Server 2.15
started with `-js`, on Node 24. Core NATS has no persistence: only JetStream fits the ports.

## The client

The modular client of the NATS project: `@nats-io/transport-node` for the connection,
`@nats-io/jetstream` for streams and consumers. Both are at 3.4.0 (published 2026-05-13),
pure JavaScript, 1.7 MB installed with their three dependencies, without install script, and
downloaded about 400 000 and 300 000 times a week. The legacy `nats` package (2.29) still
receives fixes, but it is the previous line of the client; nothing made it necessary.

## Composition root

Handlers never see this package. They publish to the outbox; the relay publishes to NATS;
each consuming context listens through the bus under its own name. The bus is given to the
application as two ports of the kernel: `IntegrationEventPublisher` stays the outbox, and
`EventSubscribers` hands each context the subscriber of its own consumer name.

`init --broker nats` writes this wiring in the platform of the project: the bus is built by
`platform/events/create-event-provider.ts`, `platform/platform.module.ts` rebinds
`EventSubscribers` on it, and `main.ts` gives it, traced, to the outbox relay. By hand, the
same thing reads:

```ts
// platform/messaging.module.ts
import { defineContextModule } from '@ddd-ts-kit/di';
import { EventSubscribers, IntegrationEventPublisher } from '@ddd-ts-kit/kernel';
import { OutboxPublisher, OutboxStore } from '@ddd-ts-kit/events';
import { NatsEventBus } from '@ddd-ts-kit/nats';

export const bus = new NatsEventBus({
  connection: config.natsUrl, // or a list, or options of the client, or a factory opening a new connection
  stream: 'integration-events', // the default
  subjectPrefix: 'events', // the default: events go to events.<event type>
  replicas: 3, // default 1
  retry: { maxAttempts: 5, delayMs: 5_000 }, // the defaults
  prefetch: 10, // the default
  onFailure: (failure) => logger.warn('event bus failure', { ...failure }), // codes only, never an error message
  onDelivery: ({ consumer, outcome }) => deliveries.add(1, { consumer, outcome }),
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

```ts
// contexts/billing/application/integration/handlers/invoice-on-order-placed.integration-handler.ts
import { CommandBus, systemActor, type IntegrationEvent } from '@ddd-ts-kit/kernel';
import { IntegrationEventHandler } from '@ddd-ts-kit/kernel/declarations';

@IntegrationEventHandler(orderPlaced, { consumer: 'billing.invoice-on-order-placed' }, [CommandBus])
export class InvoiceOnOrderPlacedIntegrationHandler {
  constructor(private readonly commands: CommandBus) {}

  // Nobody is calling: the handler acts as a system actor named after its consumer.
  readonly actor = systemActor('billing.invoice-on-order-placed');

  async handle(event: IntegrationEvent<OrderPlacedPayload>): Promise<void> {
    await this.commands.execute(new IssueInvoice(this.actor, event.payload.orderId));
  }
}
```

```ts
// main.ts
import { contextModule, createApplication, kernelModule } from '@ddd-ts-kit/di';
import { Clock } from '@ddd-ts-kit/kernel';
import { OutboxRelay, OutboxStore } from '@ddd-ts-kit/events';
import { bus, messagingModule } from '#src/platform/messaging.module.js';

const app = createApplication({
  modules: [
    kernelModule(),
    persistenceModule,
    messagingModule,
    contextModule('ordering', orderingDeclarations),
    contextModule('billing', billingDeclarations),
  ],
});

// The relay target is the bus. A record is marked published when the stream acknowledged it.
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
- `publish(events)` resolves only when the stream acknowledged **every** message of the batch
  as stored and rejects otherwise (`PUBLISH_NOT_ACKNOWLEDGED`, `BROKER_UNAVAILABLE`,
  `EVENT_BUS_CLOSED`). Nothing is buffered for later: the outbox is the buffer.
- Each message carries the header `Nats-Msg-Id` = the event id. The stream drops a second
  message with the same id inside its duplicate window (`duplicateWindowMs`, **two minutes**
  by default, set when the stream is created) and still acknowledges it: a relay that
  retries a publication whose acknowledgement was lost does not create a second message.
  The window covers a retry, not a replay hours later: consumers still deduplicate.
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
  the kernel: a declared handler (or `consume(definition, { ..., scope }, handler)` by hand,
  or a callback wrapped with `inEventScope`) runs in an execution context whose
  `correlationId` is the one of the request that published, whose `causationId` is the event,
  and a redelivery runs in the same one.
- A context extracted to its own service keeps its consumer name and so its durable
  consumers: nothing changes on the server.

## Topology

`bus.describeTopology()` returns the streams and the durable consumers as data, for a review
or a generated document; `bus.assertTopology()` creates them, idempotently. The bus also
creates them on every new connection. For `forConsumer('billing')` subscribed to
`ordering.order.placed`:

| Object | Name | Properties |
|---|---|---|
| events stream | `integration-events` | subjects `events.>`, limits retention, file storage, `replicas`, duplicate window 2 min |
| subject | `events.ordering.order.placed` | `<subjectPrefix>.<event type>`: the type is several subject tokens, matched in full by the filter |
| durable consumer | `billing_ordering_order_placed` | pull, filter subject above, explicit acknowledgement, deliver all, `ack_wait` = `ackWaitMs` (30 s), `max_deliver` = 2 x `retry.maxAttempts` |
| dead-letter stream | `integration-events-dead` | subjects `dead.events.>`, same storage and replicas |
| dead-letter subject | `dead.events.billing.ordering.order.placed` | `dead.<subjectPrefix>.<consumer>.<event type>`: one per consumer and type |

A durable name holds neither dot nor wildcard: every character of the consumer name and of
the type outside `[A-Za-z0-9_-]` becomes `_`.

A message is the envelope as JSON (`id`, `type`, `version`, `occurredAt`, `payload`,
`traceparent`, `correlationId`) with the headers `Nats-Msg-Id` (the event id),
`x-event-type`, `x-event-version`, `traceparent` and `x-correlation-id`. Any NATS client can
consume it.

Two consumers of one type have a durable consumer each and both receive every event. Two
instances of one consumer pull from the same durable consumer: each event goes to one of them.

An existing stream is never altered: the bus accepts a stream of the same name whatever its
limits, so retention, maximum age and size are yours to set on it. An existing durable
consumer takes the `ack_wait` and the `max_deliver` of the bus that declares it.

## Ordering

None. The stream keeps the publication order, but a consumer handles `prefetch` messages at
once, competing instances interleave, and a redelivery comes back after the messages that
followed. Carry a version in the payload, or use the Kafka provider when the order of an
aggregate matters.

## Retry and dead-letter behaviour

1. A message is acknowledged after every handler subscribed to its durable consumer
   resolved. A declared `@IntegrationEventHandler` (or `consume` of `@ddd-ts-kit/events` by
   hand) commits its work and its idempotency mark in one unit of work: the acknowledgement
   then follows that commit, and a redelivery is deduplicated.
2. When a handler throws, the bus refuses the message with a delay (`nak` with
   `retry.delayMs`): the server delivers it again after that delay, to any instance. The
   attempt number is the delivery count of the server. No hot loop.
3. At the `retry.maxAttempts`-th failed delivery the bus publishes a copy to the dead-letter
   subject, with `x-dead-reason: max-attempts`, `x-error-code`, `x-attempt` and `x-source`
   (`<stream>/<sequence>`), waits for the acknowledgement of the dead-letter stream, then
   terminates the original (`term`). If the copy cannot be stored the message is refused
   with the delay instead, and parked at a later delivery.
4. A message whose body is not an envelope (unparseable, or without `id`, `type`, `version`,
   `occurredAt`) is poison: it goes straight to the dead-letter stream with
   `x-dead-reason: poison` and `x-error-code: POISON_MESSAGE`, and no handler sees it.
5. Only codes travel: `x-error-code` is the `code` of the error or its class name. The message
   of an error is never logged, reported or attached, because it may quote payload data.

**Why an explicit copy and not the advisory.** When a message reaches `max_deliver` the
server stops delivering it and emits `$JS.EVENT.ADVISORY.CONSUMER.MAX_DELIVERIES`. That
advisory is a core NATS message: lost if nobody listens at that instant, it carries a stream
sequence and no failure code, and the message itself stays in the stream where no consumer
will read it again. The bus knows the failure code and knows it is the last attempt, so it
parks the message itself, with an acknowledged publication.

**Why `max_deliver` is twice `maxAttempts`.** The delivery count also grows when a delivery
ends without a verdict: a process killed mid-handler, an acknowledgement wait that expired,
a connection cut. With `max_deliver` equal to `maxAttempts`, such a delivery could use the
last one, and the server would then drop the message from the consumer silently. The bus
parks at `maxAttempts`; the server limit is a backstop above it. A message that exhausts
even that stays in the stream, undelivered: the advisory above is the alert to have.

Delivery is at least once. The copy-then-terminate order means a crash in between delivers
the message again and parks it again: the dead-letter stream keeps one copy, because the copy
has a message id of its own (`<durable>.<sequence>`).

On a lost connection the client reconnects by itself and its pull consumers resume: streams
and durable consumers live on the server, nothing has to be declared again. While the server
is away `publish` rejects at once with `BROKER_UNAVAILABLE`, and a publication in flight
rejects after `publishTimeoutMs` (5 s by default) with `PUBLISH_NOT_ACKNOWLEDGED`, so the
outbox relay keeps the records and retries them. Messages that were being handled are
delivered again after `ackWaitMs`. The bus opens the first connection itself, with an
exponential backoff (`reconnect`, 200 ms doubling up to 30 s), and a new one if the client
ever gives up.

**Credentials.** The URL or the options of `connection` are held by the function that opens the connection, in no field. A `NatsEventBus` that is logged, spread or
serialised shows `NatsEventBus [connection concealed]` and nothing else: its fields are not enumerable,
and `toJSON` and `util.inspect` answer that name. The failures it reports are codes. What the
client library itself shows when one of its own objects is inspected is not in the hands of
this package: do not log those.

**What a handler is told.** Next to the event, each handler receives the delivery
(`EventDelivery` of the kernel): `{ attempt, maxAttempts, system: 'nats', destination, consumer }`,
where `destination` is the subject. Handlers of the application ignore it; `@ddd-ts-kit/tracing` reads it
to make one CONSUMER span per attempt and to mark the redeliveries and the attempt after which
the event is buried. The bus names itself `messagingSystem: 'nats'`, and `traceparent` travels in
the envelope and as a real header, intact across a retry.

## Operations

What to watch:

| Signal | Where | Meaning |
|---|---|---|
| outbox `stats()` (`pending`, `failed`, `dead`) | the outbox store | the publishing side: see `@ddd-ts-kit/events` |
| `num_pending` of `<consumer>_<type>` | server (`nats consumer info`, the exporter) | the consumer lags or is stopped |
| `num_ack_pending` of the same | server | handled now or waiting for a redelivery; a plateau means a handler that keeps failing |
| messages in `<stream>-dead`, per subject | server (`nats stream subjects <stream>-dead`) | the dead-letter depth: must be 0, alert on anything else |
| `$JS.EVENT.ADVISORY.CONSUMER.MAX_DELIVERIES.<stream>.>` | server | a message the bus could not park before the server gave up on it |
| `onDelivery` counted by `outcome` | this bus | rate of `retried`, `dead`, `poison` against `acknowledged` |
| `onFailure` with `kind: 'connection'` | this bus | disconnections (`CONNECTION_LOST`) and requests the server refused (`JETSTREAM_<code>`) |
| `bus.deliveriesInFlight` | this bus | handlers running now; stuck above 0 means a handler that hangs |

Replaying dead messages, once the cause is fixed:

```ts
const replayed = await bus.replayDead({ consumer: 'billing', type: 'ordering.order.placed' }, 100);
```

It moves up to that many messages of that consumer from the dead-letter stream back to the
subject they came from, oldest first, each with an acknowledged copy before it is deleted
from the dead-letter stream, and with the header `x-replay-for` naming the durable consumer.
The other consumers of this kit acknowledge and skip a message marked for someone else; a
consumer written without this kit sees the event a second time and must deduplicate. The
copy is a new message: its delivery count starts again. Look at `x-dead-reason` and
`x-error-code` first: replaying a poison message only kills it again.

To stop a consumer for good, delete its durable consumers: unsubscribing leaves them, and a
stream with `interest` retention would keep their messages for ever.

## Limits

- **No ordering**, see above.
- **One delay.** The wait is the same for every attempt. The `backoff` list of a JetStream
  consumer is not used: it applies to expired acknowledgement waits, not to refusals.
- **A handler must finish within `ackWaitMs`** (30 s by default). Beyond it the server
  delivers the message to another instance while the first still runs. The bus sends no
  in-progress signal: raise `ackWaitMs` above the worst case of the handlers.
- **The duplicate window is short** and belongs to the stream: two minutes unless the stream
  was created otherwise, and an existing stream keeps its own. It absorbs a relay retry, not
  a record revived from the dead state of the outbox an hour later.
- **Retention is `limits`**, without limits: the events stream grows until you set a maximum
  age or size on it. Do not switch it to `workqueue`: two consumers could no longer both get
  every event. With `interest`, every durable consumer must exist before the first
  publication it cares about.
- **A consumer created after a publication receives it** (deliver policy `all`, as long as
  the stream retained it): a new consuming context replays the retained history of its types.
- **A redelivery runs every handler of the durable consumer again**, those that succeeded
  included, when several handlers of one consumer subscribe to the same type. Each must be
  idempotent.
- **A batch is not atomic.** When `publish` rejects, some events of the batch may have been
  stored. The relay publishes one by one and retries; the stream deduplicates, then consumers.
- **An event no consumer listens to is stored anyway**: there is no equivalent of
  `onUnroutable`.
- **Two names that differ only by a replaced character collide**: `billing.eu` and
  `billing_eu` are the same durable consumer.
- **`replayDead` reads the dead-letter stream directly**, which needs `allow_direct` on it:
  the bus sets it on the stream it creates; set it yourself on one you created.
- **A connection factory must open a new connection at each call** and should keep the
  reconnection of the client unlimited (`maxReconnectAttempts: -1`, what the bus sets when it
  is given a URL); the bus closes what it opened.
- Closing while the server is away does not wait for the acknowledgements in flight to be
  sent: those messages are delivered again.

Not verified by the test suite: a cluster of several servers (replicas above 1, leader
election, a stream that loses its quorum), TLS and authentication, an acknowledgement wait
that expires during a handler, a consumer process killed mid-handler, the `MAX_DELIVERIES`
path beyond the bus limit, a durable consumer or a stream deleted while the bus runs (the bus
then reopens its connection and declares everything again; the path is not exercised),
`interest` retention, servers older than 2.15, and the WebSocket transport.

## Other providers

`@ddd-ts-kit/rabbitmq` and `@ddd-ts-kit/kafka` implement the same two ports and pass the same
contract suite. The three share the envelope, the header names (`traceparent`,
`x-correlation-id`, `x-event-version`, `x-attempt`, `x-error-code`, `x-dead-reason`), the
option names (`consumer`, `retry`, `reconnect`, `onFailure`, `onDelivery`) and the methods
(`forConsumer`, `assertTopology`, `describeTopology`, `replayDead`, `close`).

## Testing

The suites need a real server and are skipped without `DDD_TS_KIT_TEST_NATS_URL`:

```
docker run -d --rm --name ddd-ts-kit-test-nats -p 127.0.0.1:4222:4222 nats:2.15.0-alpine -js
DDD_TS_KIT_TEST_NATS_URL=nats://127.0.0.1:4222 npx vitest run packages/nats
docker rm -f ddd-ts-kit-test-nats
```

They run the contract suite on file and on memory storage, then the behaviours of this
provider, one suite per behaviour (`publishing`, with the deduplication inside and outside
the duplicate window, `consuming`, `correlation`, `retries`, `dead-letters`, `topology`,
`connection-loss` through a TCP relay the test cuts, `closing`) and the whole chain from the
outbox to an idempotent consumer. Every test works on streams of its own and
deletes them.
