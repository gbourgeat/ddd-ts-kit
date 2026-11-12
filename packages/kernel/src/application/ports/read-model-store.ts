import type { ScopedCriteria } from '../criteria/scoped-criteria';
import type { Page } from '../pagination/page';
import type { EventStamp } from '../read-model/event-stamp';
import type { ReadModelWrite } from '../read-model/read-model-write';

/**
 * The read model of one projection: rows by key, each remembering the event that last changed
 * it. A context extends it to name its own, as it does for a repository:
 * `export abstract class AppointmentList extends ReadModelStore<AppointmentRow> {}`.
 *
 * Writes are idempotent and ordered by construction: an event older than, or the same as, what
 * the row holds changes nothing, whatever the order of the deliveries. The stamps of one key are
 * of one kind, all with a version or all without: one of each is refused with `MixedStampsError`.
 *
 * Which write for which event: `upsertIfNewer` for an event that says the whole row, or that may
 * create it; `updateIfNewer` for an event that changes a row another event created; `delete` for
 * an event that removes it.
 */
export abstract class ReadModelStore<Row> {
  abstract get(key: string): Promise<Row | undefined>;

  /**
   * Writes what `next` answers for the current row (`undefined` when there is none), unless
   * the row already holds this event or a later one. `next` answering `undefined` is a filter:
   * the event does not concern this read model, nothing is written and nothing is kept of it
   * (`ignored`). It is not how an event that changes a row waits for its creation: delivered
   * first, that event would be lost. `updateIfNewer` is.
   */
  abstract upsertIfNewer(
    key: string,
    stamp: EventStamp,
    next: (current: Row | undefined) => Row | undefined,
  ): Promise<ReadModelWrite>;

  /**
   * Writes what `change` answers for the row the key holds, unless the row already holds this
   * event or a later one (`stale`, as over the trace of a deletion that is not older than the
   * event). A key that holds no row, or the trace of a deletion older than the event, is refused
   * with `RowNotHeldError` and nothing is written: the creation this event follows has not been
   * applied yet, so the event must not be acknowledged. Let the error leave the projection: the
   * provider delivers the event again, and dead-letters it if the creation never comes.
   */
  abstract updateIfNewer(key: string, stamp: EventStamp, change: (current: Row) => Row): Promise<ReadModelWrite>;

  /**
   * Removes the row, keeping its key and its stamp and none of its data: an older event delivered
   * late does not bring it back (`applied`). A key the read model does not hold takes the same
   * trace, so the creation this deletion follows changes nothing when it is delivered after it:
   * no row was removed, and the answer is `traced`, as over the trace of an earlier deletion.
   */
  abstract delete(key: string, stamp: EventStamp): Promise<ReadModelWrite>;

  abstract search(criteria: ScopedCriteria<Row>): Promise<Page<Row>>;
}
