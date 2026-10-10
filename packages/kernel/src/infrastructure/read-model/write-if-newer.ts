import type { ReadModelRows } from '../../application/ports/read-model-rows.js';
import type { EventStamp } from '../../application/read-model/event-stamp.js';
import { isNewer } from '../../application/read-model/is-newer.js';
import type { ReadModelWrite } from '../../application/read-model/read-model-write.js';
import type { StampedRow } from '../../application/read-model/stamped-row.js';
import { ConcurrencyError } from '../../domain/errors/concurrency-error.js';

export interface StampedChange<Row> {
  readonly key: string;
  readonly stamp: EventStamp;
  /** The row to write from the current one. Absent for a deletion. */
  readonly next?: (current: Row | undefined) => Row | undefined;
}

const ATTEMPTS = 5;

/**
 * "Apply if newer", once for every store. It reads the row, gives up when the row holds this
 * event or a later one, and writes on the condition that the row still holds the stamp it
 * read: a concurrent write makes it read again, so two events of one key never overwrite each
 * other blindly, with or without a transaction.
 */
export async function writeIfNewer<Row>(rows: ReadModelRows<Row>, change: StampedChange<Row>): Promise<ReadModelWrite> {
  for (let attempt = 0; attempt < ATTEMPTS; attempt += 1) {
    const held = await rows.find(change.key);

    if (held !== undefined && !isNewer(change.stamp, held.stamp)) {
      return 'stale';
    }

    const written = await attempted(rows, change, held);

    if (written !== undefined) {
      return written;
    }
  }

  throw new ConcurrencyError(change.key);
}

/** `undefined` when another write got there first. */
async function attempted<Row>(
  rows: ReadModelRows<Row>,
  { key, stamp, next }: StampedChange<Row>,
  held: StampedRow<Row> | undefined,
): Promise<ReadModelWrite | undefined> {
  const row = next?.(held?.row);

  if (row === undefined && (next !== undefined || held === undefined)) {
    return 'ignored';
  }

  const done =
    held === undefined ? await rows.insert({ key, row, stamp }) : await rows.replace({ key, row, stamp }, held.stamp);

  return done ? 'applied' : undefined;
}
