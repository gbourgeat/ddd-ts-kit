import type { IntegrationEvent } from './integration-event.js';

/** What a subscriber is given for one event type: the function a provider calls with each delivery. */
export type IntegrationEventCallback<E extends IntegrationEvent = IntegrationEvent> = (
  event: E,
) => Promise<void>;
