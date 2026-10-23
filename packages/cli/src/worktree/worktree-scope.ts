import type { DependencyInstall } from '../worker/install-dependencies';

/** What `worktree` prepared, or would prepare in a dry run. */
export interface WorktreeScope {
  readonly name: string;
  readonly dryRun: boolean;
  /** The project inside the worktree: where every command of the session runs. */
  readonly worktree: string;
  readonly branch: string;
  readonly base: string;
  /** False when the worktree was already there: the work resumes. */
  readonly created: boolean;
  readonly install?: DependencyInstall;
  readonly notes: readonly string[];
}
