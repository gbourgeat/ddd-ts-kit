import type { DomainEvent } from '../../domain/domain-event';
import type { EventEnvelope } from './event-envelope';
import type { StoredEventData } from './stored-event-data';
import type { Upcaster } from './upcaster';

/**
 * How one domain event is kept in a stream. `encode` answers the data of the current `version`
 * under a named type (`NoShowNotedData`): that type is the stored shape, and a stored shape never
 * changes. A change of shape is a new version, with the upcaster from the previous one:
 * `upcasters: { 1: (data) => ({ ...data, reason: '' }) }` reads a version 1 as a version 2.
 */
export interface StoredEventSpec<E extends DomainEvent, Data extends object> {
  /** The version of the shape `encode` writes, from 1. */
  readonly version: number;
  encode(event: E): Data;
  /** Builds the event back from data of the current version: older data is upcast first. */
  decode(data: StoredEventData, envelope: EventEnvelope): E;
  /** By the version each one reads: one upcaster from every version below `version`. */
  readonly upcasters?: Readonly<Record<number, Upcaster>>;
}
