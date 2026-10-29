import type { Slice } from '../progress/slice';
import type { Replay } from './replay';
import { transitiveDependencies } from './transitive-dependencies';

/** The replay of a whole plan, in its order, read for what a command needs from another row. */
export interface ReplayedPlan {
  readonly replays: readonly Replay[];
  /** The replay that created the file first, by its index in `replays`; undefined for a file of the project. */
  readonly creatorOf: (file: string) => number | undefined;
  /** True when `row` waits for `other`, directly or through the rows it waits for. */
  readonly waitsFor: (row: Slice, other: Slice) => boolean;
}

/** `rows` are every row of the file: a row waits for another through rows the plan does not replay too. */
export function replayedPlan(rows: readonly Slice[], replays: readonly Replay[]): ReplayedPlan {
  const creators = new Map<string, number>();

  replays.forEach((replay, index) => {
    for (const file of replay.created) {
      creators.set(file, creators.get(file) ?? index);
    }
  });

  const waitedBy = transitiveDependencies(rows);

  return {
    replays,
    creatorOf: (file) => creators.get(file),
    waitsFor: (row, other) => waitedBy(row).has(other.id),
  };
}
