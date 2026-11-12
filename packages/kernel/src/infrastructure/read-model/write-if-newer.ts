import type { ReadModelRows } from '../../application/ports/read-model-rows';
import type { EventStamp } from '../../application/read-model/event-stamp';
import { isNewer } from '../../application/read-model/is-newer';
import type { ReadModelWrite } from '../../application/read-model/read-model-write';
import { RowNotHeldError } from '../../application/read-model/row-not-held-error';
import type { StampedRow } from '../../application/read-model/stamped-row';
import { ConcurrencyError } from '../../domain/errors/concurrency-error';
import { ReadModelKeyHeldElsewhereError } from './read-model-key-held-elsewhere-error';

export interface StampedChange<Row> {
  readonly key: string;
  readonly stamp: EventStamp;
  /**
   * The row to write from the current one. Absent for a deletion, which is written even when the
   * key is not held: the trace it leaves stops the older creation delivered after it.
   */
  readonly next?: (current: Row | undefined) => Row | undefined;
  /**
   * The row to write from the one the key holds, for an event that changes a row and does not
   * create it. Without a live row to hand it, the write is refused with `RowNotHeldError`.
   */
  readonly change?: (current: Row) => Row;
}

const ATTEMPTS = 5;

/**
 * "Apply if newer", once for every store. It reads the row, gives up when the row holds this
 * event or a later one, and writes on the condition that the row still holds the stamp it
 * read: a concurrent write makes it read again, so two events of one key never overwrite each
 * other blindly, with or without a transaction. A `change` that finds no live row, or the trace
 * of a deletion older than its event, is refused: the creation it follows has not been applied
 * yet, and the event must come back after it. A key that reads as absent, refuses an insert and
 * still reads as absent is held out of the reach of this work, by another tenant: that is settled
 * at once, since no further attempt would change it.
 */
export async function writeIfNewer<Row>(rows: ReadModelRows<Row>, change: StampedChange<Row>): Promise<ReadModelWrite> {
  let refused = false;

  for (let attempt = 0; attempt < ATTEMPTS; attempt += 1) {
    const held = await rows.find(change.key);

    if (held === undefined && refused) {
      return heldElsewhere(change);
    }

    if (held !== undefined && !isNewer(change.stamp, held.stamp, change.key)) {
      return 'stale';
    }

    const written = await attempted(rows, change, held);

    if (written !== undefined) {
      return written;
    }

    refused = held === undefined;
  }

  throw new ConcurrencyError(change.key);
}

/** Nothing of this tenant is there to delete, and its trace cannot be written; an upsert is refused by name. */
function heldElsewhere<Row>({ key, next }: StampedChange<Row>): ReadModelWrite {
  if (next === undefined) {
    return 'ignored';
  }

  throw new ReadModelKeyHeldElsewhereError(key);
}

/** `undefined` when another write got there first. */
async function attempted<Row>(
  rows: ReadModelRows<Row>,
  change: StampedChange<Row>,
  held: StampedRow<Row> | undefined,
): Promise<ReadModelWrite | undefined> {
  const { key, stamp } = change;
  const deletion = change.next === undefined && change.change === undefined;
  const row = rowOf(change, held);

  if (row === undefined && !deletion) {
    return 'ignored';
  }

  const done =
    held === undefined ? await rows.insert({ key, row, stamp }) : await rows.replace({ key, row, stamp }, held.stamp);

  if (!done) {
    return undefined;
  }

  // A deletion that found no live row removed nothing: it left, or moved forward, a trace.
  return deletion && held?.row === undefined ? 'traced' : 'applied';
}

/** What the change writes: nothing for a deletion, or for a `next` that answers nothing. */
function rowOf<Row>({ key, next, change }: StampedChange<Row>, held: StampedRow<Row> | undefined): Row | undefined {
  if (change === undefined) {
    return next?.(held?.row);
  }

  if (held?.row === undefined) {
    throw new RowNotHeldError(key);
  }

  return change(held.row);
}
