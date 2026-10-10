import type { EventContract } from './event-contract.js';
import type { IntegrationEventHandler } from './integration-event-handler.js';

export type IntegrationEventHandlerUse<Outcome> = <Payload>(
  contract: EventContract<Payload>,
  implementation: new (...args: never) => IntegrationEventHandler<Payload>,
) => Outcome;
