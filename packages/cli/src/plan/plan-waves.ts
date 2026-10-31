import { SLICES_FILE } from '../progress/read-slices';
import type { Slice } from '../progress/slice';
import { batchedWaves } from './batched-waves';
import { mergeOrder } from './merge-order';
import { otherStories } from './other-stories';
import { planProblems } from './plan-problems';
import { rowsToPlan } from './rows-to-plan';
import type { WavePlan } from './wave-plan';
import { waveNumbers } from './wave-numbers';

/** What `planWaves` plans. */
export interface PlanRequest {
  /** The context whose rows to plan; null for every row. */
  readonly context: string | null;
  /** The contexts the config declares: a row of another one is a problem. Undefined: not checked. */
  readonly contexts?: readonly string[];
  /** The ref the briefs name as `--base`; undefined when the repository has none that resolves: a brief then leaves `--base` out. */
  readonly trunk?: string | undefined;
}

/**
 * The rows of the slices file not done, in waves cut into batches, with the order of their merges.
 * A problem that makes the rows impossible to order is returned alone, without waves. With a
 * context, the rows of other contexts it waits for count in the waves but are not shown. The rows
 * of one story that rows of another wait for are listed apart, shown in the waves or not.
 */
export function planWaves(rows: readonly Slice[], request: PlanRequest): WavePlan {
  const { context } = request;
  const planned = rowsToPlan(rows, context);
  const problems = planProblems(rows, planned, request.contexts);

  if (problems.length > 0) {
    return { file: SLICES_FILE, context, problems, waves: [], mergeOrder: [], otherStories: [], started: [] };
  }

  const shown = planned.filter((row) => context === null || row.context === context);
  const waves = batchedWaves({ rows: shown, planned, numbers: waveNumbers(planned), trunk: request.trunk });

  return {
    file: SLICES_FILE,
    context,
    problems,
    waves,
    mergeOrder: mergeOrder(waves, planned),
    otherStories: otherStories(planned, waves),
    started: [],
  };
}
