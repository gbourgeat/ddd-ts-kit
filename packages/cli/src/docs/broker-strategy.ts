import type { Config } from '../config/index.js';

const BROKER_STRATEGIES: Readonly<Record<string, string>> = {
  none: 'Same process, no broker: handlers write to the transactional outbox, a relay publishes to the in-memory bus, and each consumer deduplicates in a processed-event store.',
  rabbitmq:
    'RabbitMQ: handlers write to the transactional outbox, the relay publishes with publisher confirms, each consuming context reads its own durable queues, acknowledges after its unit of work committed, retries a bounded number of times and then dead-letters.',
  kafka:
    'Kafka: handlers write to the transactional outbox, the relay produces each event to the topic of its type and marks the record published once the in-sync replicas acknowledged it, with the aggregate id as record key and a relay ordered per key, so that the events of one aggregate keep their order (`aggregateKeyOf` in the events module of the platform, given to the bus and to the relay; it takes a single running relay). Each consuming context is a consumer group of its own name, commits its offset after its unit of work committed, reads a failed record again after a delay a bounded number of times, then copies it to a dead-letter topic; the processed-event store deduplicates a redelivery.',
  nats: 'NATS JetStream: handlers write to the transactional outbox, the relay publishes each event to the stream and marks the record published once the stream acknowledged it; the stream drops a second publication of the same event id inside its duplicate window. Each consuming context reads through durable consumers of its own name, acknowledges after its unit of work committed, is delivered a failed event again after a delay a bounded number of times, then copies it to a dead-letter stream.',
  redis:
    'Redis Streams (Redis, Dragonfly or Valkey): handlers write to the transactional outbox, the relay appends each event to the stream of its type and marks the record published once the server answered its entry, each consuming context reads through a consumer group of its own name, acknowledges after its unit of work committed, is redelivered a bounded number of times after a delay and then moves the event to a dead stream. Durability is what the server is configured for, retention is bounded by its memory, and there is no order per aggregate: carry a version in the payload when it matters.',
  custom:
    'A broker of your own behind the EventBus port: handlers write to the transactional outbox, the relay publishes through the adapter in the platform, which is held to the event bus contract suite.',
};

/** The row of the strategy table of docs/ARCHITECTURE.md ("Outbox, by transport") the project chose. */
export function brokerStrategy(config: Config): string {
  const { broker, events } = config.stack;

  if (events !== 'outbox') {
    return 'Same process, no outbox: events are published straight to the in-memory bus, so a crash between a commit and its publication loses the event.';
  }

  return BROKER_STRATEGIES[broker] ?? '';
}
