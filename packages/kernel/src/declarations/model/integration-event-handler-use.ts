import type { EventContract } from './event-contract';
import type { IntegrationEventHandler } from './integration-event-handler';

export type IntegrationEventHandlerUse<Outcome> = <Payload>(
  contract: EventContract<Payload>,
  implementation: new (...args: never) => IntegrationEventHandler<Payload>,
) => Outcome;
