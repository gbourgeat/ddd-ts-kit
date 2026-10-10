import type { IntegrationEventCallback } from '../events/integration-event-callback.js';
import type { IntegrationEvent } from '../events/integration-event.js';
import type { Subscription } from '../events/subscription.js';
import type { IntegrationEventPublisher } from './integration-event-publisher.js';
import type { IntegrationEventSubscriber } from './integration-event-subscriber.js';

/** Any provider is an EventBus: in-memory, outbox and broker, queue service. */
export abstract class EventBus implements IntegrationEventPublisher, IntegrationEventSubscriber {
  static readonly tokenKey = 'kernel.EventBus';

  abstract publish(events: readonly IntegrationEvent[]): Promise<void>;

  abstract subscribe(type: string, handler: IntegrationEventCallback): Subscription;
}
