import type { IntegrationEventCallback } from '../events/integration-event-callback';
import type { IntegrationEvent } from '../events/integration-event';
import type { Subscription } from '../events/subscription';
import type { IntegrationEventPublisher } from './integration-event-publisher';
import type { IntegrationEventSubscriber } from './integration-event-subscriber';

/** Any provider is an EventBus: in-memory, outbox and broker, queue service. */
export abstract class EventBus implements IntegrationEventPublisher, IntegrationEventSubscriber {
  static {
    Object.defineProperty(this, 'tokenKey', { value: 'kernel.EventBus' });
  }

  abstract publish(events: readonly IntegrationEvent[]): Promise<void>;

  abstract subscribe(type: string, handler: IntegrationEventCallback): Subscription;
}
