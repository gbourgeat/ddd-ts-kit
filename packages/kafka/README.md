**English** · [Français](README.fr.md)

# @ddd-ts-kit/kafka

The integration event provider for Apache Kafka: an `EventBus` of the kernel that publishes
with an idempotent producer and `acks=all`, so the outbox relay can mark a record published
safely, and consumes with one consumer group per consuming context, offsets committed after
the handlers resolved, a bounded number of delayed retries in place and a dead-letter topic.
It is the "Kafka and other logs" row of the strategy table of `docs/ARCHITECTURE.md`,
implemented, and it passes `eventBusContract` of `@ddd-ts-kit/testing`.

```
npm i @ddd-ts-kit/kafka @ddd-ts-kit/events @confluentinc/kafka-javascript
```

Tested with `@confluentinc/kafka-javascript` 1.11 (librdkafka 2.16) against Apache Kafka 4.3
in KRaft mode, on Node 24. Other brokers speaking the Kafka protocol should work; only Apache
Kafka was run.

## The client

`@confluentinc/kafka-javascript` is the client maintained by Confluent: a binding of
librdkafka with a promise API in the manner of KafkaJS, which is what this package uses.

| Candidate | Looked at on 2026-10-10 | Verdict |
|---|---|---|
| `kafkajs` 2.2.4 | last release in February 2023 | not maintained: ruled out |
| `@platformatic/kafka` 2.14.0 | pure JavaScript, 2.2 MB, released almost weekly, about 500 000 downloads a week, requires Node 22.22 or 24.6 | a serious option without native code; its consumer group protocol is a young reimplementation and its engine range is above the one of this kit (22.12) |
| `@confluentinc/kafka-javascript` 1.11.0 | released 2026-10-07, about 830 000 downloads a week, librdkafka underneath | chosen: the idempotent producer, the rebalance protocol and the reconnection are those of the reference C client, which is where a provider must not be approximately right |

The price is a native addon. Nothing is compiled when a prebuilt binary exists: the install
script of the package downloads one (13 MB, 30 MB installed) from the GitHub releases of the
client. Prebuilt binaries exist for Linux x64 and arm64 on glibc and musl, macOS arm64 and
Windows x64, for Node 18 to 24. Verified here: Ubuntu with Node 24.21, and the images
`node:24-alpine` and `node:24-bookworm-slim`, each without a compiler, in about five seconds.

What it asks of CI and of images:

- the install script must run: no `--ignore-scripts`, and with a package manager that asks
  for install scripts to be approved (npm 11 warns, pnpm blocks), approve this package; the
  client documents npm as supported and Yarn and pnpm as experimental;
- the install needs to reach `github.com`; behind a proxy that forbids it, mirror the binary
  and point `node-pre-gyp` at the mirror, or the install falls back to compiling librdkafka,
  which needs Python, make and a C++ compiler and takes minutes;
- build the image on the libc it runs on: a `node_modules` installed on Debian does not load
  on Alpine;
- nothing else is needed at run time: the binary links only to libc and libstdc++.

The bus builds its producer, consumers and admin from a `KafkaJS.Kafka` it makes of `brokers`
and `client`. An application that configures or instruments that client itself hands it over
as `cluster`, and the bus then reads neither `brokers` nor `client`; it disconnects the clients
it builds, never the one it was given. The specs of this package give it a cluster held in
memory that way (see Testing).

## Composition root

Handlers never see this package. They publish to the outbox; the relay publishes to Kafka;
each consuming context listens through the bus under its own name. The bus is given to the
application as two ports of the kernel: `IntegrationEventPublisher` stays the outbox, and
`EventSubscribers` hands each context the subscriber of its own consumer name.

![In the producing context the command handler writes the order and its event to the outbox in one transaction; the OutboxRelay claims the record and gives it to KafkaEventBus.publish (idempotent producer, acks=all), which writes it to the topic of its type, keyed by the order id; each consuming context is a consumer group, notifications and billing both receive every event, the two instances of billing share the partitions; the billing handler commits its mark and its work in one unit of work before the offset is committed; a record that keeps failing goes to the dead-letter topic of billing](https://raw.githubusercontent.com/gbourgeat/ddd-ts-kit/main/docs/assets/diagrams/kafka-place-in-an-application.svg)

`init --broker kafka` writes this wiring in the platform of the project: the bus is built by
`platform/events/create-event-provider.ts`, keyed by `platform/events/aggregate-key-of.ts`,
`platform/platform.module.ts` rebinds `EventSubscribers` on it, and `main.ts` gives it, traced,
to the outbox relay of `platform/events/start-outbox-relay.ts`, which runs
`ordering: 'per-key'` with the same key. By hand, the same thing reads:

<!-- checked sample -->
```ts
// platform/messaging.module.ts
import { defineContextModule } from '@ddd-ts-kit/di';
import { EventSubscribers, IntegrationEventPublisher, type IntegrationEvent } from '@ddd-ts-kit/kernel';
import { OutboxPublisher, OutboxStore, type IntegrationEventDefinition } from '@ddd-ts-kit/events';
import { KafkaEventBus } from '@ddd-ts-kit/kafka';

// The ordering key, given to the relay and to the bus: the aggregate id an event is about.
export const aggregateOf = (event: IntegrationEvent): string | undefined =>
  orderPlaced.is(event) ? event.payload.orderId : undefined;

export const bus = new KafkaEventBus({
  brokers: config.kafkaBrokers, // 'kafka-1:9092,kafka-2:9092' or a list
  client: { 'security.protocol': 'sasl_ssl', 'sasl.mechanism': 'SCRAM-SHA-512' /* ... */ },
  keyOf: aggregateOf, // default: the event id, which orders nothing
  publishedTypes: ['billing.invoice.issued'], // their topics are created by assertTopology
  topics: { partitions: 6, replicationFactor: 3 }, // default: those of the broker
  retry: { maxAttempts: 5, delayMs: 5_000 }, // the defaults
  onFailure: (failure) => logger.warn('event bus failure', { ...failure }), // codes only, never an error message
  onDelivery: ({ consumer, topic, outcome }) => deliveries.add(1, { consumer, topic, outcome }),
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

// What the project has elsewhere, declared so that this sample compiles alone.
declare const orderPlaced: IntegrationEventDefinition<{ readonly orderId: string }>;
declare const config: { readonly kafkaBrokers: string };
declare const logger: { warn(message: string, fields: object): void };
declare const deliveries: { add(value: number, attributes: Record<string, string>): void };
```

<!-- checked sample -->
```ts
// contexts/billing/application/integration/handlers/invoice-on-order-placed.integration-handler.ts
import type { IntegrationEventDefinition } from '@ddd-ts-kit/events';
import { CommandBus, systemActor, type Actor, type Command, type IntegrationEvent } from '@ddd-ts-kit/kernel';
import { IntegrationEventHandler } from '@ddd-ts-kit/kernel/declarations';

@IntegrationEventHandler(orderPlaced, { consumer: 'billing.invoice-on-order-placed' })
export class InvoiceOnOrderPlacedIntegrationHandler {
  constructor(private readonly commands: CommandBus) {}

  // Nobody is calling: the handler acts as a system actor named after its consumer.
  readonly actor = systemActor('billing.invoice-on-order-placed');

  async handle(event: IntegrationEvent<OrderPlacedPayload>): Promise<void> {
    await this.commands.execute(new IssueInvoice(this.actor, event.payload.orderId));
  }
}

// What the project has elsewhere: the published language of ordering, the command of billing.
interface OrderPlacedPayload {
  readonly orderId: string;
}
declare const orderPlaced: IntegrationEventDefinition<OrderPlacedPayload>;
declare const IssueInvoice: new (actor: Actor, orderId: string) => Command;
```

```ts
// main.ts
import { contextModule, createApplication, kernelModule } from '@ddd-ts-kit/di';
import { Clock } from '@ddd-ts-kit/kernel';
import { OutboxRelay, OutboxStore } from '@ddd-ts-kit/events';
import { aggregateOf, bus, messagingModule } from '@/platform/messaging.module';

const app = createApplication({
  modules: [
    kernelModule(),
    persistenceModule,
    messagingModule,
    contextModule('ordering', orderingDeclarations),
    contextModule('billing', billingDeclarations),
  ],
});

// The relay target is the bus. A record is marked published when every in-sync replica has it.
const relay = new OutboxRelay({
  store: app.resolve(OutboxStore),
  publisher: bus,
  clock: app.resolve(Clock),
  ordering: 'per-key', // one running relay: the events of an aggregate leave in order
  keyOf: aggregateOf,
});

await app.start(); // subscribes the handler of billing on bus.forConsumer('billing')
await bus.assertTopology(); // fail at startup, not at the first record
relay.start({ intervalMs: 500 });

process.on('SIGTERM', async () => {
  await relay.stop(); // the tick in progress finishes
  await app.stop(); // the handlers are unsubscribed
  await bus.close(); // consumers stop, handlers in progress finish and commit
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
- `publish(events)` resolves only when every in-sync replica acknowledged **every** record of
  the batch and rejects otherwise (`PUBLISH_NOT_ACKNOWLEDGED` with the code of librdkafka in
  `reason`, `BROKER_UNAVAILABLE`, `EVENT_BUS_CLOSED`). Nothing is buffered for later: the
  outbox is the buffer.
- A consumer name is required to subscribe, and it is the consumer group id, as is:
  `bus.forConsumer('billing')` gives an `IntegrationEventSubscriber` for one context on the
  clients of the bus (a modular monolith has several), and the `consumer` option names the
  one `bus.subscribe` works for. A context extracted to its own service keeps its name, so
  its group and its offsets: nothing changes on the cluster.
- Tracing is put around both sides from outside, as with any provider: `tracedPublisher(bus)`
  as the relay target, and on the consuming side the instrumentation of the kernel module
  (`kernelModule({ instrumentation: traceApplication() })`), which gives each declared handler
  one span `process <consumer>` per attempt. `tracedSubscriber(bus.forConsumer(name))` is for
  a composition without `kernelModule`. The bus carries `traceparent` and `correlationId`
  untouched, in the envelope and in the record headers.
- The correlation makes the round trip. Publish through `scopedPublisher(publisher, scope)` of
  the kernel: a declared handler (or `consume(definition, { ..., scope }, handler)` by hand,
  or a callback wrapped with `inEventScope`) runs in an execution context whose
  `correlationId` is the one of the request that published, whose `causationId` is the event,
  and a retry runs in the same one.
- Change data capture (the Debezium outbox event router) can replace the relay and the
  publishing side of this bus; give it the same topics, keys and headers. The consuming side
  stays.

## Topology

`bus.describeTopology()` returns the topics and the groups as data, for a review or a
generated document; `bus.assertTopology()` creates the topics that do not exist and resolves
once the consumers have their partitions. For `forConsumer('billing')` subscribed to
`ordering.order.placed`:

| Object | Name | Properties |
|---|---|---|
| events topic | `ordering.order.placed` | `topicOf(type)`, by default the type; partitions and replication of `topics`, or of the broker |
| consumer group | `billing` | subscribed to the events topics of its types; starts at the earliest record |
| dead-letter topic | `billing.ordering.order.placed.dead` | `<consumer>.<topic>.dead`; written by this consumer only |
| replay group | `billing.replay` | exists once `replayDead` ran; its committed offsets on the dead-letter topics say what was replayed |

The same, as the bus describes it:

<!-- checked sample -->
```ts
import { KafkaEventBus, deadTopicOf, replayGroupOf } from '@ddd-ts-kit/kafka';

const bus = new KafkaEventBus({ brokers: 'kafka-1:9092', publishedTypes: ['billing.invoice.issued'] });

bus.forConsumer('billing').subscribe('ordering.order.placed', async () => {});

export const { topics, groups } = bus.describeTopology();
// topics: [
//   { name: 'billing.invoice.issued', role: 'events', partitions: -1, replicationFactor: -1 },
//   { name: 'ordering.order.placed', role: 'events', partitions: -1, replicationFactor: -1 },
//   { name: 'billing.ordering.order.placed.dead', role: 'dead', partitions: -1, replicationFactor: -1 },
// ]   (-1: the defaults of the broker, since `topics` is not given)
// groups: [{ groupId: 'billing', topics: ['ordering.order.placed'] }]

export const dead = deadTopicOf('billing', 'ordering.order.placed'); // 'billing.ordering.order.placed.dead'
export const replay = replayGroupOf('billing'); // 'billing.replay'
```

One topic per event type is the default. `topicOf: (type) => type.split('.')[0]` gives one
topic per producing context instead: a consumer then reads every type of that context and
skips, by committing them, those it did not subscribe to; this is what keeps the order
between two types of one aggregate.

Topics are created on demand too: the first publication of a type creates its topic, the
first subscription creates the events topic and the dead-letter topic. Automatic creation by
the broker is never relied on (it gives one partition and the default replication, silently).
An existing topic is never altered: `topics` applies at creation only. With
`topics: { create: false }` the bus creates nothing and a missing topic fails the
publication.

A record is the envelope as JSON (`id`, `type`, `version`, `occurredAt`, `payload`,
`traceparent`, `correlationId`, `tenantId`), its key is `keyOf(event)`, and its headers are
`x-event-id`, `x-event-type`, `x-event-version`, `traceparent`, `x-correlation-id` and
`x-tenant-id`. Any Kafka client can consume it.

Two consumers of one type are two groups and both receive every event. Two instances of one
consumer are two members of its group: each partition, so each key, goes to one of them.

## Ordering

Kafka orders the records of one partition, and the key chooses the partition. So:

1. Give `keyOf` the aggregate id. The default key is the event id: every event is then alone
   in its order.
2. Run the relay with `ordering: 'per-key'` and the same `keyOf`, or the order is lost before
   Kafka sees the events.
3. The bus does the rest: one publication writes the records of a topic in the order of the
   batch (idempotent producer, so a retry of the client cannot reorder or duplicate them), a
   consumer handles the records of a partition one at a time, and a failed record is retried
   **in place**, see below.

![Two events of order 1, placed then paid: with the default key, the event id, they land on two partitions owned by two instances and paid may be handled before placed; with keyOf giving the order id, both land on one partition owned by one instance and are handled in the order of the log](https://raw.githubusercontent.com/gbourgeat/ddd-ts-kit/main/docs/assets/diagrams/kafka-keys-and-partitions.svg)

<!-- checked sample -->
```ts
// platform/events/create-event-provider.ts
import { OutboxRelay, type IntegrationEventDefinition, type OutboxStore } from '@ddd-ts-kit/events';
import { KafkaEventBus } from '@ddd-ts-kit/kafka';
import type { Clock, IntegrationEvent } from '@ddd-ts-kit/kernel';

declare const orderPlaced: IntegrationEventDefinition<{ readonly orderId: string }>;
declare const orderPaid: IntegrationEventDefinition<{ readonly orderId: string; readonly amount: number }>;
declare const store: OutboxStore;
declare const clock: Clock;

// Instead of: the default key, the event id. Each event is alone in its order, so two events
// of one order may sit on two partitions and be handled side by side.
export const unordered = new KafkaEventBus({ brokers: 'kafka-1:9092' });

// Write: the aggregate id, one function given to the bus and to the relay alike.
const orderIdOf = (event: IntegrationEvent): string | undefined =>
  orderPlaced.is(event) || orderPaid.is(event) ? event.payload.orderId : undefined;

export const bus = new KafkaEventBus({ brokers: 'kafka-1:9092', keyOf: orderIdOf });

// One running relay: the records of an order leave in the order they were written.
export const relay = new OutboxRelay({ store, publisher: bus, clock, ordering: 'per-key', keyOf: orderIdOf });
```

An event that `keyOf` answers `undefined` for is published without a key: Kafka then spreads
such records over the partitions, and they keep no order between them.

`concurrency` is the number of partitions a consumer handles at once (default 1); the records
of one partition are never handled concurrently.

## Retry and dead-letter behaviour

1. An offset is committed after every handler subscribed to the type of the record resolved,
   never before, and never automatically. A declared `@IntegrationEventHandler` (or `consume`
   of `@ddd-ts-kit/events` by hand) commits its work and its idempotency mark in one unit of
   work: the commit of the offset then follows that commit, and a redelivery is deduplicated.
2. When a handler throws, the bus pauses the partition of the record for `retry.delayMs` and
   reads the same record again: no hot loop, the other partitions keep flowing, and the
   consumer keeps polling, so the wait neither delays a rebalance nor counts against
   `max.poll.interval.ms`.
3. At the `retry.maxAttempts`-th failed delivery the record is copied to the dead-letter
   topic with `x-dead-reason: max-attempts`, `x-error-code`, `x-attempt` and `x-source`
   (`<topic>/<partition>/<offset>`), its offset is committed and the partition moves on. A
   failing record holds its partition for `(maxAttempts - 1) x delayMs` plus the time of its
   handlers (20 s with the defaults), never for ever.
4. A record whose value is not an envelope (unparseable, or without `id`, `type`, `version`,
   `occurredAt`) is poison: it goes straight to the dead-letter topic with
   `x-dead-reason: poison` and `x-error-code: POISON_MESSAGE`, and no handler sees it.
5. Only codes travel: `x-error-code` is the `code` of the error or its class name. The message
   of an error is never logged, reported or attached, because it may quote payload data. The
   client logs messages and stacks of what it catches: the bus turns its logger off.

**Why retry in place and not through retry topics.** A retry topic lets the partition move on
at the first failure, and that is exactly the problem: the next event of the same aggregate
is handled before the one that failed. A database that was down for two seconds would apply
"order paid" before "order placed". Retrying in place keeps the order of a key through any
failure that heals within the attempts; the cost is that the other keys of that partition
wait too, for a bounded time. The order is given up only at the dead-letter step: the events
that follow a dead one are handled without it, and a replay brings it back late. A consumer
that cannot tolerate that must stop on the dead letter itself (carry a version in the
payload, refuse a gap).

![Two records of order 1 on one partition, placed then paid: with a retry topic, the failed placed record is moved aside, paid is handled, and placed later, so paid is applied before placed; with the retry in place of this bus, the partition is paused for retry.delayMs while the other partitions keep flowing, placed is read again and handled, then paid; after retry.maxAttempts failed deliveries the record goes to the dead-letter topic and the partition moves on](https://raw.githubusercontent.com/gbourgeat/ddd-ts-kit/main/docs/assets/diagrams/kafka-retry-in-place.svg)

The bus decides from what the handler does, so a handler that hides its failure hides it from
the bus too:

<!-- checked sample -->
```ts
import type { KafkaEventBus } from '@ddd-ts-kit/kafka';
import type { IntegrationEvent } from '@ddd-ts-kit/kernel';

declare const bus: KafkaEventBus;
declare const logger: { warn(message: string, fields: object): void };
declare function sendReceipt(event: IntegrationEvent): Promise<void>;

const notifications = bus.forConsumer('notifications');

// Instead of: catching the error. The handler resolves, the offset is committed, and the
// event is gone: no retry, no dead letter, nothing to replay.
notifications.subscribe('billing.invoice.issued', async (event) => {
  try {
    await sendReceipt(event);
  } catch {
    logger.warn('receipt not sent', { eventId: event.id });
  }
});

// Write: let it throw. The bus pauses the partition, reads the record again after
// retry.delayMs, and after retry.maxAttempts copies it to
// notifications.billing.invoice.issued.dead, where replayDead can take it back.
notifications.subscribe('billing.invoice.issued', async (event) => {
  await sendReceipt(event);
});
```

Delivery is at least once. The copy-then-commit order means a crash in between delivers the
record twice, never zero times.

**Rebalances.** Offsets are committed one record at a time, for handled records only, so a
partition that moves to another member is resumed exactly after the last handled record.
A handler in progress when its partition is taken away finishes; its commit is then refused,
and the new owner handles the record again: the processed-event store absorbs it. The count
of attempts lives in the memory of the member: a record being retried when its partition
moves, or when the process restarts, starts a fresh budget.

**Lost connections.** librdkafka reconnects by itself, producers and consumers alike, with
its own backoff. While the cluster is away `publish` rejects after `publishTimeoutMs` (30 s
by default) with `PUBLISH_NOT_ACKNOWLEDGED`, so the outbox relay keeps the records and
retries them; a publication that was cut may have been written, and its retry is then a
second record with the same event id, which consumers deduplicate. A consumer that could not
start, commit or write a dead letter reports `kind: 'connection'` and tries again after the
`reconnect` backoff (200 ms doubling up to 30 s), without moving past the record.

**Credentials.** The `client` properties (SASL password, TLS keys) go to the client library when the bus is built and are kept nowhere else. A `KafkaEventBus` that is logged, spread or
serialised shows `KafkaEventBus [clients concealed]` and nothing else: its fields are not enumerable,
and `toJSON` and `util.inspect` answer that name. The failures it reports are codes. What the
client library itself shows when one of its own objects is inspected is not in the hands of
this package: do not log those.

**What a handler is told.** Next to the event, each handler receives the delivery
(`EventDelivery` of the kernel): `{ attempt, maxAttempts, system: 'kafka', destination, consumer }`,
where `destination` is the topic. Handlers of the application ignore it; `@ddd-ts-kit/tracing` reads it
to make one CONSUMER span per attempt and to mark the redeliveries and the attempt after which
the event is buried. The bus names itself `messagingSystem: 'kafka'`, and `traceparent` travels in
the envelope and as a real header, intact across a retry.

## Operations

What to watch:

| Signal | Where | Meaning |
|---|---|---|
| outbox `stats()` (`pending`, `failed`, `dead`) | the outbox store | the publishing side: see `@ddd-ts-kit/events` |
| lag of group `<consumer>` on its events topics | cluster (`kafka-consumer-groups.sh --describe`, an exporter) | the consumer lags, is stopped, or is retrying a record: a lag that does not move is a partition held by a failing record |
| lag of group `<consumer>.replay` on `<consumer>.<topic>.dead`, or the end offset of that topic before any replay | cluster | the dead-letter depth: must be 0, alert on anything else |
| `onDelivery` counted by `outcome` | this bus | rate of `retried`, `dead`, `poison` against `acknowledged` |
| `onFailure` with `kind: 'connection'` | this bus | consumers that could not start, commit or dead-letter, with the code of librdkafka |
| `DeadLetterReports` of the kernel on `onFailure` | the error tracker | one report per event given up (dead or poison), with the error its handler threw; a retried delivery is not reported |
| `bus.deliveriesInFlight` | this bus | handlers running now; stuck above 0 means a handler that hangs |
| `bus.partitionsAssigned` | this bus | 0 on an instance that subscribed means it consumes nothing (more instances than partitions, or not joined) |
| under-replicated partitions, `min.insync.replicas` | cluster | below 2 in-sync replicas, `acks=all` protects nothing |

The signals of the bus, wired to a meter and a logger, and the replay of dead letters once the
cause is fixed:

<!-- checked sample -->
```ts
import { KafkaEventBus } from '@ddd-ts-kit/kafka';
import { DeadLetterReports, type ErrorReporter, type EventSubscribers } from '@ddd-ts-kit/kernel';

declare const deliveries: { add(value: number, attributes: Record<string, string>): void };
declare const logger: { warn(message: string, fields: object): void };
declare const errorReporter: ErrorReporter;

const deadLetters = new DeadLetterReports(errorReporter);

export const bus = new KafkaEventBus({
  brokers: ['kafka-1:9092', 'kafka-2:9092', 'kafka-3:9092'],
  // One count per settled record: acknowledged, retried, dead or poison.
  onDelivery: ({ consumer, topic, outcome }) => deliveries.add(1, { consumer, topic, outcome }),
  // Codes only, never an error message: safe to log as it is.
  onFailure: (failure) => {
    logger.warn('event bus failure', failure);
    deadLetters.onFailure(failure);
  },
});

// Bound to EventSubscribers: the reports of buried events then carry what the handler threw.
export const subscribers: EventSubscribers = { forContext: (name) => deadLetters.observing(bus.forConsumer(name)) };

// For a gauge: handlers running now, and partitions this instance consumes.
export const gauges = () => ({ inFlight: bus.deliveriesInFlight, partitions: bus.partitionsAssigned });

// Once the cause is fixed: up to 100 records back to ordering.order.placed, for billing only.
export async function replayBillingDeadLetters(): Promise<number> {
  return bus.replayDead({ consumer: 'billing', type: 'ordering.order.placed' }, 100);
}
```

It copies up to that many records from the dead-letter topic back to the topic they came
from, with the header `x-replay-for: billing`, and commits its progress on the dead-letter
topic as the group `billing.replay`. The consumers of this kit other than `billing` skip a
record marked for someone else; a consumer written without this kit sees the event a second
time and must deduplicate on `x-event-id`. The replayed record goes to the end of the topic,
so after the events that followed it. Look at `x-dead-reason` and `x-error-code` first:
replaying a poison record only kills it again. Dead-letter topics are ordinary topics: give
them a retention that leaves time to look.

To stop a consumer for good, delete its group, its replay group and its dead-letter topics.
Unsubscribing a handler does not move the group: a record whose type has no handler left
holds its partition until a handler comes back or the bus closes.

## Limits

- **A failing record delays its whole partition**, for `(maxAttempts - 1) x delayMs` plus the
  time of its handlers. Keep that well under the latency the other aggregates can accept.
- **One delay.** The wait is the same for every attempt, no exponential backoff.
- **One commit per record**, synchronous: the throughput of a partition is bounded by the
  handler plus a commit round trip. It is the price of never committing an unhandled record.
- **A handler must finish within `maxHandlingMs`** (`max.poll.interval.ms`, 5 minutes by
  default). Beyond it the member is taken for dead, its partitions move, and the record is
  handled twice, concurrently.
- **A new group starts at the earliest record** of its topics (`startFrom: 'earliest'`): a
  consumer deployed after the producers misses nothing, and a consumer added a year later
  reads a year of retained events. Choose `latest` deliberately, knowing that what is
  published between the creation of the group and its first assignment is then skipped.
- **A retry runs every handler of the type again**, those that succeeded included, when
  several handlers of one consumer subscribe to the same type. Each must be idempotent.
- **A batch is not atomic.** When `publish` rejects, some records may have been written. The
  relay publishes one by one and retries, consumers deduplicate. Transactions are not used.
- **The idempotent producer deduplicates the retries of the client, not those of the relay.**
  A record published again by the relay is a second record: the processed-event store is not
  optional.
- **Durability is a cluster setting.** `acks=all` waits for the in-sync replicas, whatever
  their number: use a replication factor of 3 with `min.insync.replicas=2`. The defaults of a
  single-node broker acknowledge with one copy.
- **`publish` does not fail fast while the cluster is away**: it waits `publishTimeoutMs`.
  Lower it for a relay that must notice quickly; it is also the bound of a healthy but slow
  acknowledgement.
- **Topic and group names** are the event type and the consumer name as given: they must fit
  the 249 characters and the `[a-zA-Z0-9._-]` alphabet of Kafka, dead-letter suffix included.
- **Partitions of an existing topic are not changed** by the bus, and adding partitions by
  hand moves keys to other partitions: the order of a key is lost across that change.
- The native client is loaded in the process: a crash of librdkafka is a crash of the
  process, and `client` is passed to it unchecked.

Not verified by the test suite: a cluster of several brokers (leader election, an in-sync
replica set that shrinks, `min.insync.replicas`), TLS and SASL, the cooperative assignor and
the next-generation group protocol (`group.protocol=consumer`), a consumer process killed
mid-handler, a fatal producer error (the bus then opens a new producer; the path is not
exercised), brokers older than 4.3, and Debezium in place of the relay.

## Other providers

`@ddd-ts-kit/rabbitmq` and `@ddd-ts-kit/nats` implement the same two ports and pass the same
contract suite. The three share the envelope, the header names (`traceparent`,
`x-correlation-id`, `x-event-version`, `x-attempt`, `x-error-code`, `x-dead-reason`), the
option names (`consumer`, `retry`, `reconnect`, `onFailure`, `onDelivery`) and the methods
(`forConsumer`, `assertTopology`, `describeTopology`, `replayDead`, `close`).
`RedisStreamsEventBus` of `@ddd-ts-kit/redis` is a fourth: same ports, same contract suite,
same option names and methods, on a server you may already run. Kafka is the one to choose
when the order of the events of an aggregate matters.

## Testing

Every suite runs in the unit run, without a broker: the bus is given, through its `cluster`
option, a Kafka cluster held in memory (`test/support/cluster/`), which implements the KafkaJS
interfaces of the client and keeps what the bus relies on (partitioned topics, a key always on
one partition, consumer groups sharing their partitions out at each join and leave with the
rebalance callback told, committed offsets, `eachMessage` read again after it threw, paused
partitions, acknowledgements that time out with `ERR__MSG_TIMED_OUT`, a topic listed a moment
after its creation, a network the test sabotages). With `DDD_TS_KIT_TEST_KAFKA_BROKERS`, the
same suites run a second time against a real broker, which is what keeps the in-memory one
honest:

```
docker run -d --rm --name ddd-ts-kit-test-kafka -p 127.0.0.1:9092:9092 -p 127.0.0.1:9094:9094 -e KAFKA_NODE_ID=1 -e KAFKA_PROCESS_ROLES=broker,controller -e KAFKA_LISTENERS=PLAINTEXT://:9092,RELAYED://:9094,CONTROLLER://:9093 -e KAFKA_ADVERTISED_LISTENERS=PLAINTEXT://127.0.0.1:9092,RELAYED://127.0.0.1:9095 -e KAFKA_LISTENER_SECURITY_PROTOCOL_MAP=CONTROLLER:PLAINTEXT,PLAINTEXT:PLAINTEXT,RELAYED:PLAINTEXT -e KAFKA_CONTROLLER_QUORUM_VOTERS=1@localhost:9093 -e KAFKA_CONTROLLER_LISTENER_NAMES=CONTROLLER -e KAFKA_INTER_BROKER_LISTENER_NAME=PLAINTEXT -e KAFKA_OFFSETS_TOPIC_REPLICATION_FACTOR=1 -e KAFKA_TRANSACTION_STATE_LOG_REPLICATION_FACTOR=1 -e KAFKA_TRANSACTION_STATE_LOG_MIN_ISR=1 -e KAFKA_GROUP_INITIAL_REBALANCE_DELAY_MS=0 apache/kafka:4.3.1
DDD_TS_KIT_TEST_KAFKA_BROKERS=127.0.0.1:9092 DDD_TS_KIT_TEST_KAFKA_RELAY=127.0.0.1:9095=127.0.0.1:9094 npx vitest run packages/kafka
docker rm -f ddd-ts-kit-test-kafka
```

The integration job of the CI runs them against a real broker on every pull request that reaches this package,
against Apache Kafka 4.3.1 in KRaft mode, with its relayed listener that `pipeline/github/scripts/start-kafka.sh` starts, its image pinned by digest.

A Kafka client connects to the addresses the broker advertises, so a network failure cannot
be produced by pointing the bus at a relay: the broker has a second listener, `RELAYED`,
that advertises `127.0.0.1:9095`, where the tests listen and relay to the port behind it
(9094). `DDD_TS_KIT_TEST_KAFKA_RELAY` gives both addresses; without it the network failure
tests run on the in-memory cluster only.

They run the contract suite on topics of one and of three partitions, then the behaviours of
this provider, one suite per behaviour (`publishing`, `consuming`, `correlation`, `retries`
in place, `dead-letters`, `partitions` for the order per key through a retry and a second
instance joining, `topology`, `connection-loss` with the acknowledged publication cut
mid-flight, `closing`) and the whole chain from the outbox to an idempotent consumer. Every test works on topics and groups of its own and deletes them.
