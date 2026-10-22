import type { DomainEvent } from '../../domain/domain-event';
import type { DomainEventType } from './domain-event-type';

/**
 * A domain event class that declares once the name its events carry,
 * `static readonly eventName = 'billing.invoice.issued'`: what its handlers and projections are
 * attached under.
 */
export type NamedDomainEventType<E extends DomainEvent, Name extends string = string> = DomainEventType<E> & {
  readonly eventName: Name;
};
