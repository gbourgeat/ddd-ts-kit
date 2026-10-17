import { readConfig } from '../config/index.js';
import { formatProgress } from '../progress/format-progress.js';
import { readProgress } from '../progress/read-progress.js';
import { formatWorkers } from '../worker/format-workers.js';
import { landedRows } from '../worker/landed-rows.js';
import { readWorkers } from '../worker/read-workers.js';
import { rowsOnBranches } from '../worker/rows-on-branches.js';
import { Workspace } from '../workspace/index.js';
import { Arguments } from './arguments.js';
import type { Command } from './command.js';

/**
 * Prints where the work stands: the next step of the plan, the slices by status and by owner, the markers left in each context.
 * Each slice not done says whether it is ready on the trunk, ready once a worker's branch merges, or waiting.
 * With `--workers`, the workers of a parallel build instead: who builds what in which worktree, and the files two of them change.
 */
export const statusCommand: Command = (argv, io) => {
  const args = Arguments.parse(argv, { workers: { type: 'boolean', default: false } });
  const root = args.projectRoot;

  const workers = readWorkers(root);

  if (args.flag('workers')) {
    io.out(args.json ? JSON.stringify(workers, null, 2) : formatWorkers(workers));

    return 0;
  }

  const rows = { onBranches: rowsOnBranches(workers), landed: landedRows(workers) };
  const progress = readProgress(new Workspace(root, false), readConfig(root).config, rows);

  io.out(args.json ? JSON.stringify(progress, null, 2) : formatProgress(progress));

  return 0;
};
