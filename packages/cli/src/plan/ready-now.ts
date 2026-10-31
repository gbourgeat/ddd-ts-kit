import type { WavePlan } from './wave-plan';

/**
 * The plan reduced to what a conductor can launch now: the first wave, whose rows have every
 * dependency done, the merge order and the rows of other stories of its batches alone, and the later
 * waves counted. A plan with problems has no waves and is returned as it is.
 */
export function readyNow(plan: WavePlan): WavePlan {
  const [first, ...later] = plan.waves;

  if (first === undefined) {
    return plan;
  }

  const shown = new Set(first.batches.map((batch) => batch.id));
  const laterBatches = later.flatMap((wave) => wave.batches);

  return {
    ...plan,
    waves: [first],
    mergeOrder: plan.mergeOrder.filter((id) => shown.has(id)),
    otherStories: plan.otherStories.filter((row) => row.batch !== null && shown.has(row.batch)),
    later: {
      waves: later.length,
      batches: laterBatches.length,
      rows: laterBatches.reduce((count, batch) => count + batch.rows.length, 0),
    },
  };
}
