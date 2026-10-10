import { ConcurrencyError } from '../../domain/errors/concurrency-error.js';

export interface VersionStep {
  /** The version the row must still have: 0 means the aggregate was never saved. */
  readonly expected: number;
  /** The version to write. */
  readonly next: number;
}

/**
 * Optimistic concurrency on the `version` column of an aggregate table.
 *
 * `write` performs the guarded statement and returns the number of rows it wrote: an insert
 * ignoring the conflict on the key when `expected` is 0, otherwise an update
 * `WHERE id = ... AND version = expected`. No row written means somebody else got there
 * first: a ConcurrencyError is raised and the aggregate keeps its version. On success the
 * aggregate carries the new version, so it can be saved again.
 */
export async function optimisticUpdate(
  aggregate: { readonly id: string | number; version: number },
  write: (step: VersionStep) => Promise<number>,
): Promise<void> {
  const expected = aggregate.version;
  const next = expected + 1;
  const written = await write({ expected, next });

  if (written !== 1) {
    throw new ConcurrencyError(aggregate.id);
  }

  aggregate.version = next;
}
