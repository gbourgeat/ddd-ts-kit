import type { Actor } from '../../application/actor/actor.js';
import type { IntegrationEvent } from '../../application/events/integration-event.js';
import type { Token } from '../token/token.js';
import type { EventContract } from './event-contract.js';
import type { IntegrationEventHandlerUse } from './integration-event-handler-use.js';

export interface IntegrationEventHandlerDeclaration {
  readonly role: 'integration-event-handler';
  readonly event: Pick<EventContract<unknown>, 'type' | 'version'>;
  /** Stable name of the consumer: the idempotency scope and the system actor it runs as. */
  readonly consumer: string;
  readonly actorOf?: (event: IntegrationEvent) => Actor | undefined;
  readonly dependencies: readonly Token<unknown>[];
  /** Hands the contract and the class to `use`, with the payload type the two share. */
  pair<Outcome>(use: IntegrationEventHandlerUse<Outcome>): Outcome;
}
