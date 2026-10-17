import type { CheckResult } from '../check/engine/check-result.js';
import type { StaleCitation } from '../citations/stale-citation.js';
import type { MergeVerification } from '../merge/lost/merge-verification.js';
import type { ScriptRun } from './script-run.js';
import type { SizedFile } from './sized-file.js';

/** What `verify-slice` found for one slice, step by step, and what is left to commit. */
export interface SliceVerification {
  readonly context: string;
  readonly since: string;
  readonly regenerate: ScriptRun;
  readonly check: CheckResult;
  readonly tests: ScriptRun;
  /** The merges of the branch since `since`, the trunk brought in: what each one lost; reported, never in `ok` in this version. */
  readonly merges: MergeVerification;
  readonly nearTheLimit: readonly SizedFile[];
  /** The paths of the slice, to stage one by one. */
  readonly toStage: readonly string[];
  /** The other changed paths of the working tree: never staged with the slice. */
  readonly leftOut: readonly string[];
  /** The names the slice removes that the design of a row not done still cites: informational, never a failure. */
  readonly citedRemovals: readonly StaleCitation[];
  readonly ok: boolean;
}
