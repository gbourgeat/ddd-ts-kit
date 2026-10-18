import { SLICES_FILE } from '../progress/read-slices.js';
import type { Slice } from '../progress/slice.js';
import { batchedWaves } from './batched-waves.js';
import { mergeOrder } from './merge-order.js';
import { planProblems } from './plan-problems.js';
import { rowsToPlan } from './rows-to-plan.js';
import type { WavePlan } from './wave-plan.js';
import { waveNumbers } from './wave-numbers.js';

/** What `planWaves` plans. */
export interface PlanRequest {
  /** The context whose rows to plan; null for every row. */
  readonly context: string | null;
}

/**
 * The rows of the slices file not done, in waves cut into batches, with the order of their merges.
 * A problem that makes the rows impossible to order is returned alone, without waves. With a
 * context, the rows of other contexts it waits for count in the waves but are not shown.
 */
export function planWaves(rows: readonly Slice[], request: PlanRequest): WavePlan {
  const { context } = request;
  const planned = rowsToPlan(rows, context);
  const problems = planProblems(rows, planned);

  if (problems.length > 0) {
    return { file: SLICES_FILE, context, problems, waves: [], mergeOrder: [] };
  }

  const shown = planned.filter((row) => context === null || row.context === context);
  const waves = batchedWaves({ rows: shown, numbers: waveNumbers(planned) });

  return { file: SLICES_FILE, context, problems, waves, mergeOrder: mergeOrder(waves, planned) };
}
