import type { EventStamp } from './event-stamp.js';

/** A row with the event that last changed it. Without `row`, the trace a deleted row leaves. */
export interface StampedRow<Row> {
  readonly key: string;
  readonly row: Row | undefined;
  readonly stamp: EventStamp;
}
