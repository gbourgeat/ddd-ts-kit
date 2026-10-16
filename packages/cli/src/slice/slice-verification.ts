import type { CheckResult } from '../check/engine/check-result.js';
import type { ScriptRun } from './script-run.js';
import type { SizedFile } from './sized-file.js';

/** What `verify-slice` found for one slice, step by step, and what is left to commit. */
export interface SliceVerification {
  readonly context: string;
  readonly since: string;
  readonly regenerate: ScriptRun;
  readonly check: CheckResult;
  readonly tests: ScriptRun;
  readonly nearTheLimit: readonly SizedFile[];
  /** The paths of the slice, to stage one by one. */
  readonly toStage: readonly string[];
  /** The other changed paths of the working tree: never staged with the slice. */
  readonly leftOut: readonly string[];
  readonly ok: boolean;
}
