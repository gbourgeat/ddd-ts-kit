**English** · [Français](message-brokers.fr.md)

# Message brokers: in-process, RabbitMQ, Kafka, NATS JetStream, Redis Streams

**Summary.** Integration events between bounded contexts leave through the transactional
outbox and reach consumers at least once; the broker is the transport in between, behind two
ports of the kernel. The kit ships five providers that pass the same contract suite: the
in-memory bus, RabbitMQ, Apache Kafka, NATS JetStream and Redis Streams (on Redis, Dragonfly or
Valkey). They are not interchangeable in what they guarantee: only Kafka keeps the order of an
aggregate's events, only RabbitMQ and Kafka confirm after a replicated write to disk, and
Redis Streams keeps events in memory. Start without a broker; add one when a context runs in
its own process, and choose it on ordering, durability and what your team already operates.

## What the broker does and does not do here

![The handler of BookAppointment writes the appointment and an outbox row in one transaction; the outbox relay publishes the row to the broker after the commit and may publish twice; the broker gives each consumer its own subscription and may deliver twice; each consumer writes its processed-event mark and its change in one unit of work, so a second delivery changes nothing](../assets/diagrams/message-brokers-outbox-to-consumers.svg)

Whatever the broker, three things are fixed by the architecture (`events/outbox-required`,
`events/consumer-idempotent` in [ARCHITECTURE.md](../ARCHITECTURE.md)):

- the event is written to the outbox in the transaction of the command, never sent to the
  broker by a handler ([transactional outbox](../concepts/transactional-outbox.md));
- the relay publishes and may publish twice; the broker may deliver twice; the consumer
  deduplicates with a processed-event store in its own database
  ([delivery and idempotency](../concepts/delivery-and-idempotency.md));
- the processed-event store is never in the broker or in Redis: the mark must commit with the
  state change it stands for.

So "exactly once" is not a property to shop for. The broker's job is to hold events durably
between two processes, give each consumer its own subscription, retry a bounded number of
times and park what cannot be handled.

What the first rule means in code. Instead of sending to the broker from the handler:

```ts
await this.appointments.save(appointment);
await this.rabbit.publish([booked]); // the commit can still fail after this line: an event for a booking that does not exist
```

publish to the `IntegrationEventPublisher` port from the handler of a domain event. The
composition root binds that port to the `OutboxPublisher`, which only appends a row in the
transaction of the command; the relay sends it after the commit, whichever broker is behind it:

<!-- checked sample -->
```ts
import { defineIntegrationEvent } from '@ddd-ts-kit/events';
import { IdGenerator, IntegrationEventPublisher, NamedDomainEvent } from '@ddd-ts-kit/kernel';
import { zodSchema } from '@ddd-ts-kit/validation/zod';
import { z } from 'zod';

// contexts/appointments/domain/events/appointment-booked.event.ts
export class AppointmentBooked extends NamedDomainEvent('appointments.appointment.booked') {
  constructor(
    readonly aggregateId: string,
    readonly occurredAt: Date,
    readonly startsAt: Date,
  ) {
    super();
  }
}

// contexts/appointments/published-language/appointment-booked.v1.integration-event.ts
export const appointmentBooked = defineIntegrationEvent({
  type: 'appointments.appointment.booked',
  version: 1,
  description: 'An appointment was booked.',
  payload: zodSchema(z.object({ appointmentId: z.string(), startsAt: z.iso.datetime() })),
});

// contexts/appointments/application/integration/publishers/appointment-booked.publisher.ts
export class AppointmentBookedPublisher {
  constructor(
    private readonly publisher: IntegrationEventPublisher,
    private readonly ids: IdGenerator,
  ) {}

  async handle(event: AppointmentBooked): Promise<void> {
    const published = appointmentBooked.create(
      { appointmentId: event.aggregateId, startsAt: event.startsAt.toISOString() },
      { id: this.ids.next(), occurredAt: event.occurredAt },
    );

    // Bound to the outbox: a row in the transaction of the command, not a message on the wire.
    await this.publisher.publish([published]);
  }
}
```

In a project the publisher is declared with `@DomainEventHandler(AppointmentBooked)`, attached
under the `eventName` the event class declares, and the generator writes it ([domain and integration events](../concepts/domain-and-integration-events.md)).

## Comparison

Server versions and licences checked on 2026-10-10 (GitHub releases and licence files). The
"kit" rows repeat what the provider READMEs state.

| | In-process | RabbitMQ | Apache Kafka | NATS JetStream | Redis Streams |
|---|---|---|---|---|---|
| Kind | function calls in one process | queue broker (AMQP 0-9-1) | replicated, partitioned log | stream persistence over NATS | in-memory log in a key-value server |
| Server and licence | none | 4.3.6, MPL 2.0 | Apache 2.0 (kit tested against 4.3, KRaft; latest version not re-checked) | 2.15.1, Apache 2.0 | Redis 8.10.2 (RSALv2, SSPLv1 or AGPLv3), Valkey 9.1.2 (BSD-3), Dragonfly 2.0.2 (BSL 1.1) |
| Confirmation of a publish means | handlers ran | broker took it; quorum queues replicate before confirming | written to the in-sync replicas (`acks=all`) | stored in the stream | held in memory by one server |
| Survives a server crash | no (the outbox does) | yes, with durable quorum queues | yes, with replication factor 3 and `min.insync.replicas=2` | yes, per the stream's storage and replicas | depends on persistence settings; can lose acknowledged entries |
| Order | per key with one relay, in one process | none | per partition, so per key | none | none across instances |
| Retention | none | until consumed | by time or size, replayable | by limits you set; replayable | bounded by memory; trimming ignores unread entries |
| A new consumer sees history | no | no | yes (starts at earliest by default) | yes (deliver policy `all`) | no by default (starts at the end) |
| Publish-side deduplication | not needed | none | client retries only, not relay retries | by message id, in a short window (two minutes by default) | none (optional guard key) |
| Retries in the kit's provider | the relay's backoff | fixed delay, retry queue | fixed delay, in place, blocks the partition | fixed delay | fixed delay |
| Dead letters | the outbox (`dead`) | dead queue per consumer queue | dead-letter topic | dead-letter stream | dead stream |
| Client used by the kit | none | amqplib 2.2 | `@confluentinc/kafka-javascript` 1.11 (native addon) | `@nats-io/transport-node`, `@nats-io/jetstream` 3.4 | ioredis 6 |
| Operations | none | one cluster, queues to watch | a cluster, partitions, consumer lag | light server, streams to size | a server you may already run |

## Selection criteria

1. **Do two processes exist?** While every context runs in one process, the in-memory bus
   behind the outbox relay is enough, and extraction later changes the provider, not the
   handlers ([modular monolith](../concepts/modular-monolith.md)).
2. **Does the order of one aggregate's events matter to a consumer?** If `analytics` must see
   `booked` before `cancelled` for the same appointment and cannot use a version in the
   payload, only Kafka gives it, with conditions (below). The cheaper answer is almost always
   to carry a version or a sequence in the payload and let the consumer ignore stale events.
3. **Can an acknowledged event ever be lost?** With Redis Streams, yes, depending on
   persistence. For reminders that may be acceptable; for billing it is not.
4. **Must a consumer added next year read last year's events?** Only a log with retention
   does that (Kafka, JetStream).
5. **What does the team operate today?** A broker nobody on the team can debug at night is a
   worse choice than a less capable one they know.
6. **Build and image constraints.** The Kafka client is a native addon with an install script.

![A decision tree: no consumer in another process leads to the in-process bus; order per aggregate without a version in the payload leads to Kafka; a consumer that must read past events leads to Kafka or NATS JetStream; events that tolerate a rare loss lead to Redis Streams on a server that is not the cache; otherwise RabbitMQ with quorum queues](../assets/diagrams/message-brokers-choosing.svg)

The second question is usually answered by the payload, not by the broker. A producer that
puts the version of the aggregate in its event lets every consumer ignore what arrives late,
on any broker, across restarts and redeliveries:

<!-- checked sample -->
```ts
import { consume, defineIntegrationEvent } from '@ddd-ts-kit/events';
import type { ProcessedEventStore, UnitOfWork } from '@ddd-ts-kit/kernel';
import { zodSchema } from '@ddd-ts-kit/validation/zod';
import { z } from 'zod';

export const appointmentStatusChanged = defineIntegrationEvent({
  type: 'appointments.appointment.status-changed',
  version: 1,
  description: 'The status of an appointment changed.',
  payload: zodSchema(
    z.object({
      appointmentId: z.string(),
      status: z.enum(['booked', 'cancelled']),
      // The version of the aggregate after the change: what lets a consumer sort the events.
      appointmentVersion: z.number().int().positive(),
    }),
  ),
});

interface OccupancyRow {
  readonly status: 'booked' | 'cancelled';
  readonly appointmentVersion: number;
}

declare const occupancy: {
  find(appointmentId: string): Promise<OccupancyRow | undefined>;
  save(appointmentId: string, row: OccupancyRow): Promise<void>;
};
declare const processed: ProcessedEventStore;
declare const unitOfWork: UnitOfWork;

// analytics: the mark of the event and the row commit together, in one unit of work.
export const occupancyOnStatusChanged = consume(
  appointmentStatusChanged,
  { consumer: 'analytics.occupancy-on-status-changed', processed, unitOfWork },
  async ({ payload }) => {
    const known = await occupancy.find(payload.appointmentId);

    if (known !== undefined && known.appointmentVersion >= payload.appointmentVersion) {
      return; // overtaken: a later change of this appointment is already applied
    }

    await occupancy.save(payload.appointmentId, { status: payload.status, appointmentVersion: payload.appointmentVersion });
  },
);
```

With that field, `cancelled` arriving before `booked` is no longer a problem: `booked` comes
second, carries a lower version, and is ignored.

## What this kit supports and verified

All four broker providers implement `IntegrationEventPublisher` and
`IntegrationEventSubscriber`, pass `eventBusContract`, share the envelope, header names, option
names and methods (`forConsumer`, `assertTopology`, `describeTopology`, `replayDead`,
`close`), reconnect with backoff, treat an unparseable message as poison, and let only error
codes travel, never error messages. Facts below come from the package READMEs
([rabbitmq](../../packages/rabbitmq/README.md), [kafka](../../packages/kafka/README.md),
[nats](../../packages/nats/README.md), [redis](../../packages/redis/README.md),
[events](../../packages/events/README.md)).

| Provider | Tested with | Topology per consumer | Stated limits |
|---|---|---|---|
| in-memory | the contract suite | handlers run inside `publish` | one process; a redelivery runs every handler of the type again |
| RabbitMQ | amqplib 2.2, RabbitMQ 4.3; only RabbitMQ was run | one topic exchange; work, retry and dead queue per consumer and event type, quorum by default | no ordering; one retry delay; queue arguments fixed at creation; classic queues can lose an expired retry on a broker crash; the crash-mid-handler path is the broker's and is not exercised by the suite |
| Kafka | client 1.11 (librdkafka 2.16), Apache Kafka 4.3 in KRaft mode, Node 24; only Apache Kafka was run | one consumer group per consuming context, topic per event type, dead-letter topic | a failing record delays its partition; one commit per record; handler must finish within `maxHandlingMs`; transactions not used; partitions of an existing topic never changed |
| NATS JetStream | client 3.4, NATS Server 2.15 with `-js`, Node 24 | one durable pull consumer per consumer and event type, dead-letter stream | no ordering; handler must finish within `ackWaitMs`; short duplicate window; retention `limits` with no limit set by default; names differing by a replaced character collide |
| Redis Streams | ioredis 6 against Dragonfly 2.0.2, Valkey 9.1.2 and Redis 8.10.2, same suite, same results | one consumer group per consumer, dead stream | durability is a server setting; no publish-side deduplication; retention bounded by memory; one entry at a time per stream and instance; run it with `noeviction`, not on the cache server |

**Not verified by the test suites**, as each README lists:

- Kafka: a cluster of several brokers (leader election, shrinking in-sync set), TLS and SASL,
  the cooperative assignor and the next-generation group protocol, a consumer killed
  mid-handler, a fatal producer error, brokers older than 4.3, Debezium in place of the relay.
- NATS: a cluster of several servers, TLS and authentication, an acknowledgement wait expiring
  during a handler, a consumer killed mid-handler, `interest` retention, servers older than
  2.15, the WebSocket transport.
- Redis Streams: Redis Cluster ("not tested on a cluster"; keys must share a slot).
- RabbitMQ: other AMQP 0-9-1 brokers; the delivery limit of quorum queues after a consumer
  crash.

In other words: every provider was proven against a single node on a developer machine or in
CI. Multi-node behaviour, security configuration and crash recovery of the consumer process
are yours to test before production.

Because the four share their option names, changing broker is a change of the platform, in
`src/platform/events/create-event-provider.ts` for a generated project. The handlers, the
outbox and the consumers stay as they are:

<!-- checked sample -->
```ts
import { KafkaEventBus } from '@ddd-ts-kit/kafka';
import type { EventBus } from '@ddd-ts-kit/kernel';
import { NatsEventBus } from '@ddd-ts-kit/nats';
import { RabbitMqEventBus } from '@ddd-ts-kit/rabbitmq';
import { RedisStreamsEventBus } from '@ddd-ts-kit/redis/event-bus';

declare const url: string;
declare const broker: 'rabbitmq' | 'kafka' | 'nats' | 'redis';

// The same policy everywhere: five deliveries, five seconds apart (the defaults), then the dead destination.
const retry = { maxAttempts: 5, delayMs: 5_000 };

const providers: Record<typeof broker, () => EventBus> = {
  rabbitmq: () => new RabbitMqEventBus({ connection: url, retry }), // quorum queues by default
  kafka: () => new KafkaEventBus({ brokers: url, retry }), // keyOf: the key of each record, for ordering
  nats: () => new NatsEventBus({ connection: url, retry }),
  redis: () => new RedisStreamsEventBus({ connection: url, retry }), // Redis, Valkey or Dragonfly
};

export const bus = providers[broker]();
```

When a handler keeps failing, all four do the same thing:

![After a failed attempt the provider delivers the event again after a fixed delay, up to maxAttempts deliveries; then the event goes to the dead destination of the provider (dead queue, dead-letter topic, dead-letter stream or dead stream), is reported once when DeadLetterReports is wired, and replayDead delivers it again once the cause is fixed](../assets/diagrams/message-brokers-retry-and-dead-letter.svg)

**What the kit does not provide at all**: SQS/SNS, Google Pub/Sub, Azure Service Bus, Pulsar,
Redpanda (may work as a Kafka-protocol broker; never run), change data capture (described as
a relay strategy, not shipped), exponential backoff on the consuming side (one fixed delay
everywhere), Kafka transactions, schema registries, and sagas or process managers
([sagas and process managers](../concepts/sagas-and-process-managers.md)). `stack.broker:
custom` generates a bus file and its contract spec for you to fill.

Ordering with Kafka holds only if all of these are true: `keyOf` gives the aggregate id, the
relay runs with `ordering: 'per-key'` and the same key, **a single relay runs**, and the topic
keeps its partition count. The relay's per-key memory is lost on restart, so one event may
overtake another once after a crash; strict ordering across restarts is stated as not done.

## Limits and when not to use it

- **A broker does not replace the outbox.** Publishing from a handler loses events when the
  commit fails after the publish, or invents them when the publish fails after the commit.
- **A broker does not make consumers idempotent.** Every provider redelivers.
- **Same fixed retry delay** on all four: a dependency that is down for an hour sends events
  to the dead destination after `maxAttempts` times the delay. Size both, monitor the dead
  destination (it must be empty), and use `replayDead` after the fix.
- **Redis Streams on the cache server**: an eviction policy that suits a cache can evict a
  stream. Separate servers, or `noeviction`.
- **New consumers and history** differ by provider (see the table): a consumer added to Kafka
  or JetStream replays what is retained and must tolerate old events; one added to RabbitMQ or
  Redis Streams starts from now and needs a backfill by other means.

When not to add a broker: one deployable, one team, no consumer outside the process. The
in-memory provider behind the outbox has the same semantics for handlers, and
`npm run dev` needs one container fewer.

## Recommendation by situation

| Situation | Choice |
|---|---|
| Modular monolith, single deployable | in-process, outbox relay woken by the database or polling |
| First extracted context, team knows RabbitMQ, no ordering need | RabbitMQ with quorum queues |
| Order per aggregate required by consumers, replay of history, many consumers | Kafka, if someone can operate it; otherwise a version in the payload and RabbitMQ |
| Small operations budget, replay wanted, ordering not needed | NATS JetStream, with retention limits set explicitly |
| Redis, Valkey or Dragonfly already operated, moderate volume, events that tolerate a rare loss | Redis Streams, on a server that is not the cache |
| A cloud queue service imposed | `custom` provider held to `eventBusContract`, following the strategy table of the events package |

Whatever the choice, write it in the project's integration documentation (delivery
guarantees, retry and dead-letter policy, how to replay) and record it as a decision.

## Sources

- RabbitMQ documentation: publisher confirms https://www.rabbitmq.com/docs/confirms , quorum
  queues https://www.rabbitmq.com/docs/quorum-queues , dead lettering
  https://www.rabbitmq.com/docs/dlx
- Apache Kafka documentation (producer `acks`, idempotence, consumer groups):
  https://kafka.apache.org/documentation/
- NATS JetStream documentation: https://docs.nats.io/nats-concepts/jetstream
- Redis Streams: https://redis.io/docs/latest/develop/data-types/streams/ ; Valkey:
  https://valkey.io/topics/streams-intro/ ; Dragonfly: https://www.dragonflydb.io/docs
- GitHub releases and licence files of `rabbitmq/rabbitmq-server`, `nats-io/nats-server`,
  `redis/redis`, `valkey-io/valkey`, `dragonflydb/dragonfly`, read on 2026-10-10.
- Chris Richardson, Microservices Patterns, Manning, 2018, chapter 3; microservices.io:
  Transactional outbox, Idempotent consumer.
- Gregor Hohpe and Bobby Woolf, Enterprise Integration Patterns, Addison-Wesley, 2003:
  Guaranteed Delivery, Dead Letter Channel, Idempotent Receiver.
- Martin Kleppmann, Designing Data-Intensive Applications, O'Reilly, 2017, chapter 11.
- Not verified: the latest Apache Kafka release on the day of writing (the kit's own README
  names 4.3); any behaviour of the providers on multi-node clusters.

## See also

- [Domain and integration events](../concepts/domain-and-integration-events.md)
- [Transactional outbox](../concepts/transactional-outbox.md)
- [Delivery and idempotency](../concepts/delivery-and-idempotency.md)
- [Event versioning](../concepts/event-versioning.md)
- [Cache and coordination](cache-and-coordination.md)
- [Persistence](persistence.md)
- [When to extract microservices](../guides/when-to-extract-microservices.md)
