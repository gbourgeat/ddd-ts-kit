import type { MigrationOrderFinding } from '../order/migration-order-finding';
import type { MergeCheck } from './merge-check';

/** What `verify-merge` found, merge by merge. */
export interface MergeVerification {
  /** The ref the merges were listed from; absent for a named commit, or when no trunk was found. */
  readonly since?: string;
  /** Oldest first, the merge in progress last. */
  readonly merges: readonly MergeCheck[];
  /** The migrations of the branch that do not follow the trunk's: never softened by `--warn`. Empty for a named commit. */
  readonly migrations: readonly MigrationOrderFinding[];
  /** What the merges lost, plus the migrations out of order. */
  readonly errorCount: number;
  readonly warningCount: number;
  /** No error: warnings, accepted and repaired findings do not fail. */
  readonly ok: boolean;
}
