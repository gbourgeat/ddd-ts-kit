import type { Decision } from '../authorization/decision.js';
import type { TraceStep } from './trace-step.js';

/** A decision and why: every question asked on the way, in order. `traceText` renders the trace. */
export interface Explanation {
  readonly decision: Decision;
  readonly trace: readonly TraceStep[];
}
