import type { Awaitable } from '../awaitable';

/** What a contract of a read model is told about the storage behind the table, to check what a deleted row leaves there. */
export interface ReadModelStorageUnderContract {
  /** What the storage holds under a key, by field of the row, read beside the store. */
  readonly stored?: (key: string) => Awaitable<Readonly<Record<string, unknown>> | undefined>;
  /** Whether the storage holds `title` unique. */
  readonly uniqueTitle?: boolean;
}
