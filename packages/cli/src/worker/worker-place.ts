import type { CitationsAtRef } from '../citations/stale-names-at.js';
import type { Config } from '../config/index.js';
import type { BriefedSlice } from './briefed-slice.js';

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
  readonly slices: readonly BriefedSlice[];
  /** The names their design cites that the trunk does not have. */
  readonly citations: CitationsAtRef;
}
