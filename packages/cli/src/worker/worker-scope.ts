import type { Slice } from '../progress/slice.js';

/** The place one worker builds one context in, and what to tell that worker. */
export interface WorkerScope {
  readonly dryRun: boolean;
  readonly context: string;
  /** The name of the project directory. */
  readonly project: string;
  /** Absolute path of the git worktree. */
  readonly worktree: string;
  /** Absolute path of the project inside the worktree: where every command of the worker runs. */
  readonly root: string;
  readonly branch: string;
  /** The branch the worktree was cut from, and that the worker merges back from. */
  readonly trunk: string;
  /** True when this run created the worktree, or would with `--dry-run`. */
  readonly created: boolean;
  /** Absolute path of the file that confines the worker to its context. */
  readonly scopeFile: string;
  /** The generator kinds the worker may run; the conductor runs the others on the trunk. */
  readonly generators: readonly string[];
  /** The rows of the slices table owned by the context and still to do. */
  readonly slices: readonly Slice[];
  readonly briefing: string;
  readonly notes: readonly string[];
}
