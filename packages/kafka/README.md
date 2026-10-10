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

## Composition root

Handlers never see this package. They publish to the outbox; the relay publishes to Kafka;
each consuming context subscribes through the bus under its own name.

```ts
// main.ts
import { SystemClock, type IntegrationEvent } from '@ddd-ts-kit/kernel';
import { OutboxPublisher, OutboxRelay, consume, subscribeAll, validatingPublisher } from '@ddd-ts-kit/events';
import { KafkaEventBus } from '@ddd-ts-kit/kafka';
import { tracedPublisher, tracedSubscriber } from '@ddd-ts-kit/tracing';

// The ordering key, given to the relay and to the bus: the aggregate id an event is about.
const aggregateOf = (event: IntegrationEvent): string | undefined =>
  orderPlaced.is(event) ? event.payload.orderId : undefined;

const bus = new KafkaEventBus({
  brokers: config.kafkaBrokers, // 'kafka-1:9092,kafka-2:9092' or a list
  client: { 'security.protocol': 'sasl_ssl', 'sasl.mechanism': 'SCRAM-SHA-512' /* ... */ },
  keyOf: aggregateOf, // default: the event id, which orders nothing
  publishedTypes: ['billing.invoice.issued'], // their topics are created by assertTopology
  topics: { partitions: 6, replicationFactor: 3 }, // default: those of the broker
  retry: { maxAttempts: 5, delayMs: 5_000 }, // the defaults
  onFailure: (failure) => logger.warn(failure), // codes only, never an error message
  onDelivery: ({ consumer, topic, outcome }) => deliveries.add(1, { consumer, topic, outcome }),
});

// Publishing side: handlers write to the outbox, in the transaction of the command.
const publisher = validatingPublisher(new OutboxPublisher(outboxStore), registry);

// The relay target is the bus. A record is marked published when every in-sync replica has it.
const relay = new OutboxRelay({
  store: outboxStore,
  publisher: tracedPublisher(bus),
  clock: new SystemClock(),
  ordering: 'per-key', // one running relay: the events of an aggregate leave in order
  keyOf: aggregateOf,
});
relay.start({ intervalMs: 500 });

// Consuming side: one subscriber per consuming context, named after it.
const billingEvents = tracedSubscriber(bus.forConsumer('billing'));
subscribeAll(billingEvents, [
  consume(orderPlaced, { consumer: 'billing.ordering.order.placed', processed, unitOfWork }, async (event) => {
    await commandBus.execute(new IssueInvoice(event.payload.orderId));
  }),
]);

await bus.assertTopology(); // fail at startup, not at the first record

process.on('SIGTERM', async () => {
  await relay.stop(); // the tick in progress finishes
  await bus.close(); // consumers stop, handlers in progress finish and commit
});
```

- `publish(events)` resolves only when every in-sync replica acknowledged **every** record of
  the batch and rejects otherwise (`PUBLISH_NOT_ACKNOWLEDGED` with the code of librdkafka in
  `reason`, `BROKER_UNAVAILABLE`, `EVENT_BUS_CLOSED`). Nothing is buffered for later: the
  outbox is the buffer.
- A consumer name is required to subscribe, and it is the consumer group id, as is:
  `bus.forConsumer('billing')` gives an `IntegrationEventSubscriber` for one context on the
  clients of the bus (a modular monolith has several), and the `consumer` option names the
  one `bus.subscribe` works for. A context extracted to its own service keeps its name, so
  its group and its offsets: nothing changes on the cluster.
- The tracing wrappers work as with any provider: the bus carries `traceparent` and
  `correlationId` untouched, in the envelope and in the record headers.
- The correlation makes the round trip. Publish through `scopedPublisher(publisher, scope)` of
  the kernel and consume with `consume(definition, { ..., scope }, handler)`, or wrap a
  handler with `inEventScope`: the consumer runs in an execution context whose
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
`traceparent`, `correlationId`), its key is `keyOf(event)`, and its headers are `x-event-id`,
`x-event-type`, `x-event-version`, `traceparent` and `x-correlation-id`. Any Kafka client can
consume it.

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

`concurrency` is the number of partitions a consumer handles at once (default 1); the records
of one partition are never handled concurrently.

## Retry and dead-letter behaviour

1. An offset is committed after every handler subscribed to the type of the record resolved,
   never before, and never automatically. Use `consume` of `@ddd-ts-kit/events`: the commit
   then follows the commit of the unit of work, and a redelivery is deduplicated.
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

## Operations

What to watch:

| Signal | Where | Meaning |
|---|---|---|
| outbox `stats()` (`pending`, `failed`, `dead`) | the outbox store | the publishing side: see `@ddd-ts-kit/events` |
| lag of group `<consumer>` on its events topics | cluster (`kafka-consumer-groups.sh --describe`, an exporter) | the consumer lags, is stopped, or is retrying a record: a lag that does not move is a partition held by a failing record |
| lag of group `<consumer>.replay` on `<consumer>.<topic>.dead`, or the end offset of that topic before any replay | cluster | the dead-letter depth: must be 0, alert on anything else |
| `onDelivery` counted by `outcome` | this bus | rate of `retried`, `dead`, `poison` against `acknowledged` |
| `onFailure` with `kind: 'connection'` | this bus | consumers that could not start, commit or dead-letter, with the code of librdkafka |
| `bus.deliveriesInFlight` | this bus | handlers running now; stuck above 0 means a handler that hangs |
| `bus.partitionsAssigned` | this bus | 0 on an instance that subscribed means it consumes nothing (more instances than partitions, or not joined) |
| under-replicated partitions, `min.insync.replicas` | cluster | below 2 in-sync replicas, `acks=all` protects nothing |

Replaying dead letters, once the cause is fixed:

```ts
const replayed = await bus.replayDead({ consumer: 'billing', type: 'ordering.order.placed' }, 100);
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
(`forConsumer`, `assertTopology`, `describeTopology`, `replayDead`, `close`). Kafka is the one
to choose when the order of the events of an aggregate matters.

## Testing

The suites need a real broker and are skipped without `DDD_TS_KIT_TEST_KAFKA_BROKERS`:

```
docker run -d --rm --name ddd-ts-kit-test-kafka -p 127.0.0.1:9092:9092 -p 127.0.0.1:9094:9094 -e KAFKA_NODE_ID=1 -e KAFKA_PROCESS_ROLES=broker,controller -e KAFKA_LISTENERS=PLAINTEXT://:9092,RELAYED://:9094,CONTROLLER://:9093 -e KAFKA_ADVERTISED_LISTENERS=PLAINTEXT://127.0.0.1:9092,RELAYED://127.0.0.1:9095 -e KAFKA_LISTENER_SECURITY_PROTOCOL_MAP=CONTROLLER:PLAINTEXT,PLAINTEXT:PLAINTEXT,RELAYED:PLAINTEXT -e KAFKA_CONTROLLER_QUORUM_VOTERS=1@localhost:9093 -e KAFKA_CONTROLLER_LISTENER_NAMES=CONTROLLER -e KAFKA_INTER_BROKER_LISTENER_NAME=PLAINTEXT -e KAFKA_OFFSETS_TOPIC_REPLICATION_FACTOR=1 -e KAFKA_TRANSACTION_STATE_LOG_REPLICATION_FACTOR=1 -e KAFKA_TRANSACTION_STATE_LOG_MIN_ISR=1 -e KAFKA_GROUP_INITIAL_REBALANCE_DELAY_MS=0 apache/kafka:4.3.1
DDD_TS_KIT_TEST_KAFKA_BROKERS=127.0.0.1:9092 DDD_TS_KIT_TEST_KAFKA_RELAY=127.0.0.1:9095=127.0.0.1:9094 npx vitest run packages/kafka
docker rm -f ddd-ts-kit-test-kafka
```

A Kafka client connects to the addresses the broker advertises, so a network failure cannot
be produced by pointing the bus at a relay: the broker has a second listener, `RELAYED`,
that advertises `127.0.0.1:9095`, where the tests listen and relay to the port behind it
(9094). `DDD_TS_KIT_TEST_KAFKA_RELAY` gives both addresses; without it the three network
failure tests are skipped and the rest runs.

They run the contract suite on topics of one and of three partitions, then the behaviours of
this provider (acknowledged publication cut mid-flight, retry in place, dead-lettering,
replay, poison, separate and competing consumers, order per key through a retry, a second
instance joining, reconnection, graceful close) and the whole chain from the outbox to an
idempotent consumer. Every test works on topics and groups of its own and deletes them.
