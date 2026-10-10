import type { IntegrationEventCallback } from '../events/integration-event-callback.js';
import type { Subscription } from '../events/subscription.js';

/** What integration event handlers are subscribed to: the event bus by default, a broker adapter otherwise. */
export abstract class IntegrationEventSubscriber {
  static {
    Object.defineProperty(this, 'tokenKey', { value: 'kernel.IntegrationEventSubscriber' });
  }

  abstract subscribe(type: string, handler: IntegrationEventCallback): Subscription;
}
