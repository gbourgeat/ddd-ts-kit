import type { BranchMigration } from './branch-migration.js';

/** What a replay deletes and generates again, read before anything is touched. */
export interface ReplayPlan {
  readonly root: string;
  readonly base: string;
  /** The migrations folder, relative to the project root. */
  readonly folder: string;
  /** In their order. */
  readonly migrations: readonly BranchMigration[];
  /**
   * The history on disk forks from the base: a snapshot of the branch was generated from one the
   * base has since followed with its own, or the journal does not list the files as one chain.
   * Otherwise the migrations of the branch already follow the last one of the base.
   */
  readonly forked: boolean;
  /** The files of the migrations folder and of its `meta/` as the replay found them, by path: what a refusal puts back. */
  readonly found: ReadonlyMap<string, string>;
}
