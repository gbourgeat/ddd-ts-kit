import type { CommitLimits } from '../config/index.js';

/** The size of the commit a `git commit` would make now, against the advised limits. */
export interface CommitSize {
  /** False outside a git repository: nothing was measured. */
  readonly gitRepository: boolean;
  /** True when only the index was measured. */
  readonly staged: boolean;
  /** Changed files, generated ones not counted. */
  readonly files: number;
  /** Lines added and removed in them. */
  readonly lines: number;
  readonly limits: CommitLimits;
  readonly over: boolean;
  /** The slices the changes belong to, the largest first. */
  readonly slices: readonly SliceSize[];
}

export interface SliceSize {
  readonly slice: string;
  readonly files: number;
}
