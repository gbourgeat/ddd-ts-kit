/**
 * The only thing that crosses a bounded-context boundary: a versioned, serializable,
 * backward-compatible contract owned by the producer (its published language).
 */
export interface IntegrationEvent<Payload = unknown> {
  readonly id: string;
  /** Routing key, `<context>.<aggregate>.<fact>`. */
  readonly type: string;
  /** Bumped on every breaking change of `payload`; old versions keep being served. */
  readonly version: number;
  readonly occurredAt: string;
  readonly payload: Payload;
  /** W3C traceparent captured at publication so consumers continue the same trace. */
  readonly traceparent?: string;
  readonly correlationId?: string;
}

export type IntegrationEventHandler<E extends IntegrationEvent = IntegrationEvent> = (
  event: E,
) => Promise<void>;

/** Driving port for any provider: in-memory, outbox + broker, SQS, Kafka, NATS, RabbitMQ... */
export interface IntegrationEventPublisher {
  publish(events: readonly IntegrationEvent[]): Promise<void>;
}

export interface Subscription {
  unsubscribe(): void;
}

export interface IntegrationEventSubscriber {
  subscribe(type: string, handler: IntegrationEventHandler): Subscription;
}

/** Idempotency guard: at-least-once delivery is the rule, so every consumer needs one. */
export interface ProcessedEventStore {
  /** Returns true the first time `(consumer, eventId)` is seen, false afterwards. */
  markProcessed(consumer: string, eventId: string): Promise<boolean>;
  /**
   * Forgets a mark taken by a delivery whose handler then failed, so the redelivery is
   * handled. Stores whose mark shares the handler's transaction do not need it: the
   * rollback already removes the mark.
   */
  release?(consumer: string, eventId: string): Promise<void>;
}

/** Any provider is an EventBus: in-memory, outbox and broker, queue service. */
export interface EventBus extends IntegrationEventPublisher, IntegrationEventSubscriber {}
