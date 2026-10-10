import type { ScopedCriteria } from '../criteria/scoped-criteria.js';
import type { Page } from '../pagination/page.js';
import type { EventStamp } from '../read-model/event-stamp.js';
import type { ReadModelWrite } from '../read-model/read-model-write.js';

/**
 * The read model of one projection: rows by key, each remembering the event that last changed
 * it. A context extends it to name its own, as it does for a repository:
 * `export abstract class AppointmentList extends ReadModelStore<AppointmentRow> {}`.
 *
 * Writes are idempotent and ordered by construction: an event older than, or the same as, what
 * the row holds changes nothing, whatever the order of the deliveries.
 */
export abstract class ReadModelStore<Row> {
  abstract get(key: string): Promise<Row | undefined>;

  /**
   * Writes what `next` answers for the current row (`undefined` when there is none), unless
   * the row already holds this event or a later one. `next` answering `undefined` writes nothing.
   */
  abstract upsertIfNewer(
    key: string,
    stamp: EventStamp,
    next: (current: Row | undefined) => Row | undefined,
  ): Promise<ReadModelWrite>;

  /** Removes the row, keeping its stamp: an older event delivered late does not bring it back. */
  abstract delete(key: string, stamp: EventStamp): Promise<ReadModelWrite>;

  abstract search(criteria: ScopedCriteria<Row>): Promise<Page<Row>>;
}
