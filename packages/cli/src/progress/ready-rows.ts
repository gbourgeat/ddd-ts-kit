import { SLICE_STATUS } from './slice';
import type { Progress } from './progress';

/**
 * The progress reduced to the rows a conductor can launch now: not started, every dependency done.
 * The counts by status and by owner stay; the rows left out are counted in `notShown`.
 */
export function readyRows(progress: Progress): Progress {
  if (progress.slices === null) {
    return progress;
  }

  const rows = progress.slices.rows.filter((row) => row.status === SLICE_STATUS.todo && row.ready === 'trunk');
  const open = progress.slices.rows.filter((row) => row.status !== SLICE_STATUS.done).length;

  return { ...progress, slices: { ...progress.slices, rows, notShown: open - rows.length } };
}
