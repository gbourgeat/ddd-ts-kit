import {
  executionContextOfEvent,
  idempotent,
  type Actor,
  type ExecutionScope,
  type IntegrationEvent,
  type IntegrationEventCallback,
  type ProcessedEventStore,
} from '@ddd-ts-kit/kernel';
import type { EventContract, IntegrationEventHandler } from '@ddd-ts-kit/kernel/declarations';

export type { EventContract, IntegrationEventHandler };

export interface ConsumerOptions {
  /**
   * Stable name of the consumer, `<context>.<reaction>`: the idempotency scope, and the system
   * actor the consumer runs as in `EXECUTION_SCOPE`.
   */
  readonly consumer: string;
  /**
   * The actor an event names, for a project whose envelopes carry a reference to one. The
   * consumer then runs as that actor instead of `systemActor(consumer)`.
   */
  readonly actorOf?: (event: IntegrationEvent) => Actor | undefined;
}

/** What the application gives every consumer when it starts: both are left out when not bound. */
export interface ConsumerRuntime {
  readonly processed?: ProcessedEventStore;
  readonly scope?: ExecutionScope;
}

/** An event of the subscribed type and version that its contract refuses. */
export class UnreadableEventError extends Error {
  readonly code = 'UNREADABLE_EVENT';

  constructor(
    readonly eventType: string,
    readonly eventVersion: number,
    readonly reason: string,
  ) {
    super(`Cannot read ${eventType} v${eventVersion}: ${reason}`);
    this.name = 'UnreadableEventError';
  }
}

export interface Reception<Payload> {
  readonly contract: EventContract<Payload>;
  readonly options: ConsumerOptions;
  readonly runtime: ConsumerRuntime;
  readonly handle: (event: IntegrationEvent<Payload>) => Promise<void>;
}

/**
 * The handler to subscribe for one consumer. Another version of the same type is skipped
 * (it has its own contract); an unreadable event throws so that the provider retries or
 * dead-letters it instead of losing it silently. With a scope, the idempotency mark and the
 * consumer run in the execution context of the event: origin `event`, its correlation, the
 * event as cause.
 */
export function receive<Payload>(reception: Reception<Payload>): IntegrationEventCallback {
  const { contract, options, runtime, handle } = reception;
  const { processed, scope } = runtime;
  return async (event) => {
    const parsed = contract.parse(event);
    if (!parsed.ok) {
      rejectUnlessMeantForAnother(event, parsed.error.reason);
      return;
    }
    const deliver = (): Promise<void> => handle(parsed.value);
    // Marked only once the event is known to be valid, so a skipped or rejected delivery
    // never consumes the idempotency key.
    const once = (): Promise<void> =>
      processed === undefined ? deliver() : idempotent(options.consumer, processed, deliver)(event);
    await (scope === undefined ? once() : scope.run(executionContextOfEvent(event, options), once));
  };
}

const MEANT_FOR_ANOTHER = new Set(['type-mismatch', 'version-mismatch']);

function rejectUnlessMeantForAnother(event: IntegrationEvent, reason: string): void {
  if (!MEANT_FOR_ANOTHER.has(reason)) {
    throw new UnreadableEventError(event.type, event.version, reason);
  }
}
