import type { WorkersStatus } from './workers-status';

/**
 * The ids of the rows briefed to a worker whose branch has commits its base does not have: they
 * are on their way to the trunk. A worker without commits ahead, or whose base is unknown, has
 * nothing on its way yet; nor has one whose branch was squash-merged into its base with nothing
 * since: its commits are counted from where it landed.
 */
export function rowsOnBranches(status: WorkersStatus): Set<string> {
  return new Set(status.workers.filter((worker) => (worker.ahead ?? 0) > 0).flatMap((worker) => worker.rows ?? []));
}
