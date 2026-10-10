import type { Actor, IntegrationEvent } from '@ddd-ts-kit/kernel';

export interface ConsumerOptions {
  /**
   * Stable name of the consumer, `<context>.<reaction>`: the idempotency scope, and the system
   * actor the consumer runs as in the `ExecutionScope`.
   */
  readonly consumer: string;
  /**
   * The actor an event names, for a project whose envelopes carry a reference to one. The
   * consumer then runs as that actor instead of `systemActor(consumer)`.
   */
  readonly actorOf?: (event: IntegrationEvent) => Actor | undefined;
}
