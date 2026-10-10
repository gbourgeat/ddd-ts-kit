import type { CriteriaPlan } from '../criteria/criteria-plan.js';
import type { ListedRows } from '../read-model/listed-rows.js';
import type { TouchedKey } from '../read-model/touched-key.js';
import { ReadModelRows } from './read-model-rows.js';

/**
 * What a store adapter gives for the table of one read model: its rows, the query of a plan,
 * and the steps of a rebuild. `TableReadModelStore` and `ProjectionRebuild` are written on it.
 */
export abstract class ReadModelTable<Row> extends ReadModelRows<Row> {
  /** The rows of a plan that is not empty, deleted ones left out, and their total for an offset page. */
  abstract list(plan: CriteriaPlan): Promise<ListedRows<Row>>;

  /** Whether a rebuild is in progress: writes then record their key with `touch`. */
  abstract rebuilding(): Promise<boolean>;

  abstract touch(key: string): Promise<void>;

  /** Opens an empty copy of the table, holding the traces of the deleted rows, and starts recording touched keys. */
  abstract beginRebuild(): Promise<void>;

  /** The rows of the copy being rebuilt. */
  abstract shadow(): ReadModelRows<Row>;

  abstract touched(limit: number): Promise<readonly TouchedKey[]>;

  /** Forgets the touched keys that were not touched again since they were read. */
  abstract settle(keys: readonly TouchedKey[]): Promise<void>;

  /** Inside a unit of work: no write goes through until it ends. */
  abstract holdWriters(): Promise<void>;

  /** Inside the same unit of work: the copy takes the place of the table. */
  abstract promote(): Promise<void>;

  /** Drops what a rebuild opened, if anything: the table itself is left as it is. */
  abstract abandonRebuild(): Promise<void>;
}
