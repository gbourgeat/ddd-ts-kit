import type { IntegrationEventSubscriber } from './integration-event-subscriber.js';

/**
 * The subscriber of each bounded context. One bus serves them all by default; a broker gives
 * every consuming context its own, so that an extracted context keeps its queues.
 */
export abstract class EventSubscribers {
  static {
    Object.defineProperty(this, 'tokenKey', { value: 'kernel.EventSubscribers' });
  }

  abstract forContext(name: string): IntegrationEventSubscriber;
}
