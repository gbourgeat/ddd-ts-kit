import type { DomainEvent } from '../../domain/domain-event';
import type { EventEnvelope } from './event-envelope';
import type { StoredData } from './stored-data';
import type { StoredEventData } from './stored-event-data';
import type { Upcaster } from './upcaster';

/** One stored event as `defineStoredEvent` declared it, ready for the serializer. */
export interface StoredEventType<E extends DomainEvent> {
  readonly version: number;
  readonly upcasters: Readonly<Record<number, Upcaster>>;
  /** Refuses an event of another class than the declared one. */
  encode(event: DomainEvent): StoredData;
  decode(data: StoredEventData, envelope: EventEnvelope): E;
}
