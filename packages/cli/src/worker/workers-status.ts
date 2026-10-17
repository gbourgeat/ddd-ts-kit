import type { WorkerProgress } from './worker-progress.js';

/** Who builds what, in which worktree, and where two workers meet: what `status --workers` says. */
export interface WorkersStatus {
  /** One entry per worktree holding `.ddd-ts-kit/worker.json`, in the order git lists them. */
  readonly workers: readonly WorkerStatus[];
  readonly overlaps: Overlaps;
}

/** One worker. What its scope file does not say (a file written before the rows and the base were recorded) is left out. */
export interface WorkerStatus {
  /** Absolute path of the git worktree. */
  readonly worktree: string;
  /** The branch checked out there, or the one its scope file names on a detached HEAD. */
  readonly branch?: string;
  readonly context: string;
  /** The ids of the rows it was briefed on. */
  readonly rows?: readonly string[];
  /** The ref it was cut from. */
  readonly base?: string;
  /**
   * The commits on its branch that the base does not have, since the commit the base took it in
   * at when it was squash-merged there; left out when the base is unknown or names no commit.
   */
  readonly ahead?: number;
  /** The commits of the base its branch does not have. */
  readonly behind?: number;
  /** The commit of the base that took its branch in (a squash), found by patch id, when one did. */
  readonly landed?: Landed;
  /** What `merge-trunk` would leave conflicted now, computed from what the base already holds; left out when nothing is to merge. */
  readonly mergePreview?: { readonly conflicts: number; readonly files: readonly string[] };
  /** Whether its copy of the project has its dependencies (`node_modules`): without them its hooks and checks fail. */
  readonly installed: boolean;
  /**
   * The files it changed, relative to the top of the repository: committed since the merge base
   * with its base (since where it landed, once the base took it in), modified, and untracked but
   * not ignored. Without a known base, the modified and untracked ones only.
   */
  readonly files: readonly string[];
  /** Its `.ddd-ts-kit/report.md`; null while it has written none. */
  readonly report: WorkerReport | null;
  /** Where its rows stand and what the conductor does next; left out when its config cannot be read. */
  readonly progress?: WorkerProgress;
}

export interface WorkerReport {
  /** Absolute path. */
  readonly file: string;
  /** When it was last written, as an ISO 8601 date. */
  readonly modified: string;
}

/** Where two workers or more meet: each is a merge conflict to come. */
export interface Overlaps {
  /** Each context built by more than one worker, with their worktrees. */
  readonly contexts: readonly { readonly context: string; readonly worktrees: readonly string[] }[];
  /** Each file changed by more than one worker, relative to the top of the repository, with their worktrees. */
  readonly files: readonly { readonly file: string; readonly worktrees: readonly string[] }[];
}

/** Where a worker's branch landed on its base, and what of it. */
export interface Landed {
  /** The commit of the base that took the branch in. */
  readonly commit: string;
  readonly subject: string;
  /** The rows briefed to the worker that its branch had done where it landed. */
  readonly rows: readonly string[];
}
