import type { Slice } from '../progress/slice.js';
import type { Batch, Wave } from './wave-plan.js';

/**
 * The ids of the batches in the order they merge: by wave, and in a wave, the batch the most
 * planned rows wait for, directly or not, first; then in the order of the file.
 */
export function mergeOrder(waves: readonly Wave[], planned: readonly Slice[]): string[] {
  const reach = reachOf(planned);

  const waiting = (batch: Batch): number =>
    planned.filter((row) => batch.rows.some((held) => reach(row).has(held.id))).length;

  return waves.flatMap((wave) =>
    [...wave.batches].sort((left, right) => waiting(right) - waiting(left)).map((batch) => batch.id),
  );
}

/** The ids a row waits for, directly or through other rows, among the planned ones. */
function reachOf(planned: readonly Slice[]): (row: Slice) => ReadonlySet<string> {
  const byId = new Map(planned.map((row) => [row.id, row]));
  const reached = new Map<string, Set<string>>();

  const reach = (row: Slice): Set<string> => {
    const known = reached.get(row.id);

    if (known !== undefined) {
      return known;
    }

    const ids = new Set<string>();

    reached.set(row.id, ids);

    for (const id of row.dependsOn) {
      const dependency = byId.get(id);

      if (dependency !== undefined) {
        ids.add(id);
        reach(dependency).forEach((further) => ids.add(further));
      }
    }

    return ids;
  };

  return reach;
}
