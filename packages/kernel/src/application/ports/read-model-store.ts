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
 * the row holds changes nothing, whatever the order of the deliveries. That order is
 * total among stamps of one kind, all with a version or all without, so a key should see one kind
 * (`isNewer`).
 *
 * Which write for which event: `upsertIfNewer` for an event that says the whole row, or that may
 * create it, which is right in any order of delivery; `updateIfNewer` for an event that changes
 * part of a row another event created, which is right only when the events of the key are applied
 * in order; `delete` for an event that removes it.
 */
export abstract class ReadModelStore<Row> {
  abstract get(key: string): Promise<Row | undefined>;

  /**
   * Writes what `next` answers for the current row (`undefined` when there is none), unless
   * the row already holds this event or a later one. `next` answering `undefined` is a filter:
   * the event does not concern this read model, nothing is written and nothing is kept of it
   * (`ignored`). An event that changes a row another event created goes through `updateIfNewer`,
   * which tells a row that is not there (`missing`) from an event that is filtered.
   */
  abstract upsertIfNewer(
    key: string,
    stamp: EventStamp,
    next: (current: Row | undefined) => Row | undefined,
  ): Promise<ReadModelWrite>;

  /**
   * Writes what `change` answers for the row the key holds, unless the row already holds this
   * event or a later one (`stale`, as over the trace of a deletion that is not older than the
   * event). Under a key that holds no row, or the trace of a deletion older than the event, or a
   * row of another tenant, nothing is written and the answer is `missing`. The store never throws
   * for it and cannot apply the change later: the projection decides, by answering it (the event
   * concerns a row this read model does not keep, or the row was removed outside the history) or
   * by throwing an error of its own where its feed delivers a failed event again. An older change
   * applied after a later one is `stale`: only events applied in the order of their key lose none.
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
