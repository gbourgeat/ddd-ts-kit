import type { EventStamp } from './event-stamp';

/**
 * Two stamps of one key, one with a version and one without. A version counts the events of a
 * key and an instant reads a clock: neither says where the other stands, so no order holds
 * between them, and a rule that picked one would drop events in silence. Every stamp written
 * under a key is of one kind: the events of a projection and the rows of the source it is
 * rebuilt from all carry a version, or none does.
 */
export class MixedStampsError extends Error {
  constructor(
    readonly incoming: EventStamp,
    readonly held: EventStamp,
    readonly key?: string,
  ) {
    const where = key === undefined ? 'A read model' : `The read model, under the key "${key}",`;

    super(
      `${where} holds a stamp ${kindOf(held)} (event "${held.eventId}") and is given a stamp ${kindOf(incoming)} (event "${incoming.eventId}"): a version and an instant do not order each other. Stamp every event that writes this key the same way, stampOf(event, version) for all or stampOf(event) for all, the rows of the source of a rebuild included; a read model that changes kind is emptied and rebuilt`,
    );

    this.name = 'MixedStampsError';
  }
}

function kindOf(stamp: EventStamp): string {
  return stamp.version === undefined ? 'without a version' : 'with a version';
}
