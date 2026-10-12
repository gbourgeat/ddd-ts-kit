import type { DomainEvent } from '../../domain/domain-event.js';
import type { EventEnvelope } from './event-envelope.js';
import type { StoredData } from './stored-data.js';
import type { StoredEventData } from './stored-event-data.js';
import type { Upcaster } from './upcaster.js';

/** One stored event as `defineStoredEvent` declared it, ready for the serializer. */
export interface StoredEventType<E extends DomainEvent> {
  readonly version: number;
  readonly upcasters: Readonly<Record<number, Upcaster>>;
  /** Refuses an event of another class than the declared one. */
  encode(event: DomainEvent): StoredData;
  decode(data: StoredEventData, envelope: EventEnvelope): E;
}
