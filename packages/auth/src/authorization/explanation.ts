import type { Decision } from './decision';
import type { TraceStep } from './trace-step';

/**
 * A decision and why: every question the model asked on the way, in order. Empty when the
 * model refused before asking anything, as it does the anonymous actor. `traceText` renders it.
 */
export interface Explanation {
  readonly decision: Decision;
  readonly trace: readonly TraceStep[];
}
