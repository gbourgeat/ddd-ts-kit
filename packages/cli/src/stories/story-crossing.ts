import type { MergeForecast } from './merge-forecast';

/** Where two open stories meet: a context both change, a file both change, a conflict the second to land settles. */
export interface StoryCrossing {
  /** The two stories; from the worktree of a story, that story first. */
  readonly stories: readonly [string, string];
  /** The contexts the rows of both name. */
  readonly contexts: readonly string[];
  /**
   * The files both worktrees changed, committed or not, but those `merge-trunk` settles by their
   * kind alone (slices.md, the derived files, the lockfile, the stored-events lock).
   */
  readonly files: readonly string[];
  /** The branch of the second merged into the branch of the first now; absent when either has no branch. */
  readonly merge?: MergeForecast;
}
