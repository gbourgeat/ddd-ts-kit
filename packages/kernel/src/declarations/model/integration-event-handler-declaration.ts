import type { Actor } from '../../application/actor/actor';
import type { IntegrationEvent } from '../../application/events/integration-event';
import type { Token } from '../token/token';
import type { EventContract } from './event-contract';
import type { IntegrationEventHandlerUse } from './integration-event-handler-use';

export interface IntegrationEventHandlerDeclaration {
  readonly role: 'integration-event-handler';
  readonly event: Pick<EventContract<unknown>, 'type' | 'version'>;
  /** Stable name of the consumer: the idempotency scope and the system actor it runs as. */
  readonly consumer: string;
  readonly actorOf?: (event: IntegrationEvent) => Actor | undefined;
  /** The list the decorator wrote; `undefined` when the constructor states the dependencies. */
  readonly dependencies: readonly Token<unknown>[] | undefined;
  /** Hands the contract and the class to `use`, with the payload type the two share. */
  pair<Outcome>(use: IntegrationEventHandlerUse<Outcome>): Outcome;
}
