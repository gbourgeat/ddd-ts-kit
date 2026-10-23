import type { EventDelivery } from './event-delivery';
import type { IntegrationEvent } from './integration-event';

/**
 * What a subscriber is given for one event type: the function a provider calls with each
 * delivery, and with what it knows of that delivery.
 */
export type IntegrationEventCallback<E extends IntegrationEvent = IntegrationEvent> = (
  event: E,
  delivery?: EventDelivery,
) => Promise<void>;
