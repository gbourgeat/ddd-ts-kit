import type { IntegrationEventSubscriber, Subscription } from '@ddd-ts-kit/kernel';
import type { EventSubscription } from './event-subscription';

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
