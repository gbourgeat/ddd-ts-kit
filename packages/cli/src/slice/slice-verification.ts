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
  readonly toStage: readonly string[];
  readonly ok: boolean;
}
