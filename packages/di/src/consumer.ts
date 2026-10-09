import {
  idempotent,
  type IntegrationEvent,
  type IntegrationEventHandler,
  type ProcessedEventStore,
  type Result,
} from '@ddd-ts-kit/kernel';

/**
 * What `builder.on(...)` needs from an event declaration. A definition made by
 * `defineIntegrationEvent` of `@ddd-ts-kit/events` fits as it is; this package does not
 * depend on it.
 */
export interface EventContract<Payload> {
  readonly type: string;
  readonly version: number;
  parse(event: IntegrationEvent): Result<IntegrationEvent<Payload>, { readonly reason: string }>;
}

/**
 * A class of `application/integration/consumers/`. `handle` is declared as a property so that
 * the compiler compares its parameter strictly: a consumer of another event is rejected.
 */
export interface EventConsumer<Payload> {
  readonly handle: (event: IntegrationEvent<Payload>) => Promise<void>;
}

export interface ConsumerOptions {
  /** Stable name of the consumer, `<context>.<reaction>`: the idempotency scope. */
  readonly consumer: string;
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
  readonly consumer: string;
  readonly processed: ProcessedEventStore | undefined;
  readonly handle: (event: IntegrationEvent<Payload>) => Promise<void>;
}

/**
 * The handler to subscribe for one consumer. Another version of the same type is skipped
 * (it has its own contract); an unreadable event throws so that the provider retries or
 * dead-letters it instead of losing it silently.
 */
export function receive<Payload>(reception: Reception<Payload>): IntegrationEventHandler {
  const { contract, consumer, processed, handle } = reception;
  return async (event) => {
    const parsed = contract.parse(event);
    if (!parsed.ok) {
      rejectUnlessMeantForAnother(event, parsed.error.reason);
      return;
    }
    const deliver = (): Promise<void> => handle(parsed.value);
    // Marked only once the event is known to be valid, so a skipped or rejected delivery
    // never consumes the idempotency key.
    await (processed === undefined ? deliver() : idempotent(consumer, processed, deliver)(event));
  };
}

const MEANT_FOR_ANOTHER = new Set(['type-mismatch', 'version-mismatch']);

function rejectUnlessMeantForAnother(event: IntegrationEvent, reason: string): void {
  if (!MEANT_FOR_ANOTHER.has(reason)) {
    throw new UnreadableEventError(event.type, event.version, reason);
  }
}
