import type { CitationsAtRef } from '../citations/stale-names-at.js';
import type { BriefedSlice } from './briefed-slice.js';

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
  /** The base: the ref the worktree was cut from (`--base`, by default the current branch), that the worker checks against and merges back from. */
  readonly trunk: string;
  /** True when this run created the worktree, or would with `--dry-run`. */
  readonly created: boolean;
  /** Absolute path of the file that confines the worker to its context. */
  readonly scopeFile: string;
  /** The generator kinds the worker may run; the conductor runs the others on the trunk. */
  readonly generators: readonly string[];
  /** The rows of the slices table the worker builds: those of `--rows`, by default those of the context still to do. */
  readonly slices: readonly BriefedSlice[];
  /** The names the design of those rows cites that the trunk does not have, checked at the trunk. */
  readonly citations: CitationsAtRef;
  readonly briefing: string;
  readonly notes: readonly string[];
}
