import type { DomainEvent } from '../../domain/domain-event.js';
import type { DomainEventType } from './domain-event-type.js';
import type { EventContract } from './event-contract.js';

export interface IntegrationEventApplication {
  readonly kind: 'integration';
  /** The method of the projection that applies the event. */
  readonly method: string;
  readonly contract: EventContract<unknown>;
}

export interface DomainEventApplication {
  readonly kind: 'domain';
  readonly method: string;
  readonly event: DomainEventType<DomainEvent>;
  /** The `name` the events of this type carry: what the dispatcher routes by. */
  readonly name: string;
}

/** One "this method applies that event" of a projection, as `@On` wrote it. */
export type ProjectionApplication = IntegrationEventApplication | DomainEventApplication;
