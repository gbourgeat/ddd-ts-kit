import type { DomainEvent } from '../../domain/domain-event.js';
import type { EventSourcedAggregate } from '../../domain/event-sourcing/event-sourced-aggregate.js';
import { unstoredEvents } from '../../domain/event-sourcing/unstored-events.js';

export interface StreamChanges {
  /** The version the stream must still have. */
  readonly expected: number;
  /** What the aggregate recorded since it was loaded, in order. */
  readonly events: readonly DomainEvent[];
}

/**
 * Optimistic concurrency for an event-sourced aggregate: hands what it recorded since it was
 * loaded to `append`, with the version its stream must still have. Once `append` resolves, the
 * aggregate is at the new version with nothing left to store, and can be saved again; when it
 * rejects (a ConcurrencyError: somebody else appended first), the aggregate is left as it was.
 */
export async function appendChanges<E extends DomainEvent, S>(
  aggregate: EventSourcedAggregate<E, S>,
  append: (changes: StreamChanges) => Promise<void>,
): Promise<void> {
  const unstored = unstoredEvents.get(aggregate) ?? [];

  if (unstored.length === 0) {
    return;
  }

  const events = [...unstored];

  await append({ expected: aggregate.version, events });
  unstored.splice(0, events.length);
  aggregate.version += events.length;
}
