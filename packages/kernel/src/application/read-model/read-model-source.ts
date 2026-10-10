import type { Page } from '../pagination/page.js';
import type { StampedRow } from './stamped-row.js';

/**
 * Where a read model is rebuilt from: the read contract the owning context publishes, behind
 * a gateway port. Each row comes stamped with the last event its state reflects (its id and
 * instant, or its per-key version), which is what lets a rebuild and live events meet.
 */
export interface ReadModelSource<Row> {
  /** Every row, by pages: `undefined` asks for the first, then the `nextCursor` of the previous. */
  export(cursor: string | undefined): Promise<Page<StampedRow<Row>>>;
  /** The rows of these keys as they are now. A key the source no longer has is left out. */
  lookup(keys: readonly string[]): Promise<ReadonlyMap<string, StampedRow<Row>>>;
}
