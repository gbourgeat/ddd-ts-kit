import type { ReadModelRows } from '../../application/ports/read-model-rows';
import type { EventStamp } from '../../application/read-model/event-stamp';
import { isNewer } from '../../application/read-model/is-newer';
import type { ReadModelWrite } from '../../application/read-model/read-model-write';
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
}

const ATTEMPTS = 5;

/**
 * "Apply if newer", once for every store. It reads the row, gives up when the row holds this
 * event or a later one, and writes on the condition that the row still holds the stamp it
 * read: a concurrent write makes it read again, so two events of one key never overwrite each
 * other blindly, with or without a transaction. A key that reads as absent, refuses an insert and
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

    if (held !== undefined && !isNewer(change.stamp, held.stamp)) {
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
  { key, stamp, next }: StampedChange<Row>,
  held: StampedRow<Row> | undefined,
): Promise<ReadModelWrite | undefined> {
  const row = next?.(held?.row);

  if (row === undefined && next !== undefined) {
    return 'ignored';
  }

  const done =
    held === undefined ? await rows.insert({ key, row, stamp }) : await rows.replace({ key, row, stamp }, held.stamp);

  if (!done) {
    return undefined;
  }

  // A deletion that found no live row removed nothing: it left, or moved forward, a trace.
  return next === undefined && held?.row === undefined ? 'traced' : 'applied';
}
