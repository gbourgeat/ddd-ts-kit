import type { Config } from '../config/index.js';
import type { Slice } from '../progress/slice.js';

/** What a briefing is filled with. */
export interface WorkerPlace {
  readonly config: Config;
  readonly context: string;
  readonly project: string;
  /** Absolute path of the project inside the worktree. */
  readonly root: string;
  readonly branch: string;
  readonly trunk: string;
  readonly generators: readonly string[];
  readonly slices: readonly Slice[];
}
