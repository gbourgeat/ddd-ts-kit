import {
  idempotent,
  type IntegrationEvent,
  type IntegrationEventHandler,
  type IntegrationEventSubscriber,
  type ProcessedEventStore,
  type Subscription,
} from '@ddd-ts-kit/kernel';
import { InvalidEventPayloadError, type IntegrationEventDefinition } from './definition.js';

export interface EventSubscription {
  readonly type: string;
  readonly handler: IntegrationEventHandler;
}

export interface OnOptions {
  /** Name of the consuming context or handler: the idempotency scope. */
  readonly consumer: string;
  /** When given, a redelivered event is handled once per consumer. */
  readonly processed?: ProcessedEventStore;
}

/**
 * Typed subscription to one version of one event. Another version of the same type is
 * skipped (subscribe to it with its own definition); an invalid payload throws so that the
 * provider retries or dead-letters instead of silently losing the event.
 */
export function on<P>(
  definition: IntegrationEventDefinition<P>,
  handler: (event: IntegrationEvent<P>) => Promise<void>,
  options?: OnOptions,
): EventSubscription {
  const store = options?.processed;
  return {
    type: definition.type,
    handler: async (event) => {
      const parsed = definition.parse(event);
      if (!parsed.ok) {
        if (parsed.error.reason === 'invalid-payload') {
          throw new InvalidEventPayloadError(event.type, event.version, parsed.error.issues);
        }
        return;
      }
      if (options === undefined || store === undefined) {
        await handler(parsed.value);
        return;
      }
      // Marked only once the event is known to be ours and valid, so a skipped or rejected
      // delivery never consumes the idempotency key.
      await idempotent(options.consumer, store, () => handler(parsed.value))(event);
    },
  };
}

/** Registers every subscription and returns one handle that removes them all. */
export function subscribeAll(
  subscriber: IntegrationEventSubscriber,
  subscriptions: readonly EventSubscription[],
): Subscription {
  const handles = subscriptions.map(({ type, handler }) => subscriber.subscribe(type, handler));
  return {
    unsubscribe: () => {
      for (const handle of handles) {
        handle.unsubscribe();
      }
    },
  };
}
