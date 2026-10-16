import type { BranchMigration } from './branch-migration.js';

/** What a replay deletes and generates again, read before anything is touched. */
export interface ReplayPlan {
  readonly root: string;
  readonly base: string;
  /** The migrations folder, relative to the project root. */
  readonly folder: string;
  /** In their order. */
  readonly migrations: readonly BranchMigration[];
}
