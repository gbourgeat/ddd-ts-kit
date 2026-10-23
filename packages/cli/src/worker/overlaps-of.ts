import type { Overlaps, WorkerStatus } from './workers-status';

/** The contexts and the files that more than one worker holds, each with the worktrees that hold it. */
export function overlapsOf(workers: readonly WorkerStatus[]): Overlaps {
  return {
    contexts: shared(workers, (worker) => [worker.context]).map(([context, worktrees]) => ({ context, worktrees })),
    files: shared(workers, (worker) => worker.files).map(([file, worktrees]) => ({ file, worktrees })),
  };
}

function shared(
  workers: readonly WorkerStatus[],
  held: (worker: WorkerStatus) => readonly string[],
): [string, string[]][] {
  const holders = new Map<string, string[]>();

  for (const worker of workers) {
    for (const name of held(worker)) {
      holders.set(name, [...(holders.get(name) ?? []), worker.worktree]);
    }
  }

  return [...holders].filter(([, worktrees]) => worktrees.length > 1).sort(([a], [b]) => a.localeCompare(b));
}
