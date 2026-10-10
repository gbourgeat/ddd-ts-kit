import type { IntegrationEvent } from '../../application/events/integration-event.js';

/**
 * A class of `application/integration/handlers/`. `handle` is declared as a property so that
 * the compiler compares its parameter strictly: a handler of another event is rejected.
 */
export interface IntegrationEventHandler<Payload> {
  readonly handle: (event: IntegrationEvent<Payload>) => Promise<void>;
}
