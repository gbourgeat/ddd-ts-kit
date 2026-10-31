import { readConfig } from '../config';
import { mergeInProgress } from '../merge/merge-in-progress';
import { inDialect } from '../package-manager/in-dialect';
import { formatProgress } from '../progress/format-progress';
import { readyRows } from '../progress/ready-rows';
import { readProgress } from '../progress/read-progress';
import { formatWorkers } from '../worker/format-workers';
import { landedRows } from '../worker/landed-rows';
import { readWorkers } from '../worker/read-workers';
import { rowsOnBranches } from '../worker/rows-on-branches';
import { Workspace } from '../workspace';
import { Arguments } from './arguments';
import type { Command } from './command';
import { stdoutJson } from '../json/stdout-json';

/**
 * Prints where the work stands: the next step of the plan, the slices by status and by owner, the markers left in each context.
 * Each slice not done says whether it is ready on the trunk, ready once a worker's branch merges, or waiting.
 * With `--ready`, only the rows a conductor can start now: not started, every dependency done.
 * With `--workers`, the workers of a parallel build instead: who builds what in which worktree, and the files two of them change.
 */
export const statusCommand: Command = (argv, io) => {
  const args = Arguments.parse(argv, {
    workers: { type: 'boolean', default: false },
    ready: { type: 'boolean', default: false },
  });

  const root = args.projectRoot;

  const workers = readWorkers(root);

  if (args.flag('workers')) {
    io.out(args.json ? stdoutJson(workers) : formatWorkers(workers));

    return 0;
  }

  const rows = { onBranches: rowsOnBranches(workers), landed: landedRows(workers) };
  const { config } = readConfig(root);
  const all = readProgress(new Workspace(root, false), config, rows);
  const progress = args.flag('ready') ? readyRows(all) : all;
  const merge = mergeInProgress(root);
  const line = merge === undefined ? undefined : inDialect(merge, config.stack.packageManager);

  io.out(
    args.json
      ? stdoutJson(line === undefined ? progress : { mergeInProgress: line, ...progress })
      : `${line === undefined ? '' : `${line}\n\n`}${formatProgress(progress)}`,
  );

  return 0;
};
