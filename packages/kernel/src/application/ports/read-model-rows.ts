import type { EventStamp } from '../read-model/event-stamp';
import type { StampedRow } from '../read-model/stamped-row';

/**
 * The three statements a store adapter gives for one table of stamped rows. The rule "apply
 * if newer" is written once above them, in `writeIfNewer`: an adapter only reads and writes.
 */
export abstract class ReadModelRows<Row> {
  /** The row of the key with its stamp, a deleted one included (without `row`). */
  abstract find(key: string): Promise<StampedRow<Row> | undefined>;

  /** Inserts unless the key exists or the entry has no `row`, and says whether it did. */
  abstract insert(entry: StampedRow<Row>): Promise<boolean>;

  /** Replaces the row of the key if it still holds the stamp `held`, and says whether it did. */
  abstract replace(entry: StampedRow<Row>, held: EventStamp): Promise<boolean>;
}
