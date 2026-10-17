import type { MergeCheck } from './merge-check.js';

/** What `verify-merge` found, merge by merge. */
export interface MergeVerification {
  /** The ref the merges were listed from; absent for a named commit, or when no trunk was found. */
  readonly since?: string;
  /** Oldest first, the merge in progress last. */
  readonly merges: readonly MergeCheck[];
  readonly errorCount: number;
  readonly warningCount: number;
  /** No error: warnings, accepted and repaired findings do not fail. */
  readonly ok: boolean;
}
