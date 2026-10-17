import type { WorkersStatus } from './workers-status.js';

/**
 * The rows that landed on the trunk with a worker's branch, by id, with the commit of the trunk
 * that took them in: a row the slices file of the trunk does not mark done yet is to mark.
 */
export function landedRows(status: WorkersStatus): Map<string, string> {
  return new Map(
    status.workers.flatMap((worker) =>
      (worker.landed?.rows ?? []).map((id) => [id, worker.landed?.commit ?? ''] as const),
    ),
  );
}
