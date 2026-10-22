import type { DomainEvent } from '../../domain/domain-event';
import type { StoredEventType } from './stored-event-type';

/** The stored events of one aggregate, by the name each carries: every event of the union is declared. */
export type StoredEventTypes<E extends DomainEvent> = {
  readonly [Name in E['name']]: StoredEventType<Extract<E, { readonly name: Name }>>;
};
