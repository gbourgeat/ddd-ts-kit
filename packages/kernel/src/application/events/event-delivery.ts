/**
 * What a provider says of one delivery, next to the event: identifiers of the transport only,
 * for what observes the consumers from outside (a trace, a metric). Handlers never read it.
 */
export interface EventDelivery {
  /** Which delivery of the event to this consumer this is, starting at 1. */
  readonly attempt: number;
  /** The delivery after which the provider gives the event up. Absent when it never does. */
  readonly maxAttempts?: number;
  /** The transport: `rabbitmq`, `kafka`, `nats`, `redis`, `in-memory`. */
  readonly system?: string;
  /** What the event was read from: a queue, a topic, a stream, a subject. */
  readonly destination?: string;
  /** The queue consumer, consumer group or durable the delivery belongs to. */
  readonly consumer?: string;
}
