import { readConfig } from '../config/index.js';
import { formatProgress } from '../progress/format-progress.js';
import { readProgress } from '../progress/read-progress.js';
import { Workspace } from '../workspace/index.js';
import { Arguments } from './arguments.js';
import type { Command } from './command.js';

/** Prints where the work stands: the next step of the plan, the slices by status and by owner, the markers left in each context. */
export const statusCommand: Command = (argv, io) => {
  const args = Arguments.parse(argv, {});
  const root = args.projectRoot;
  const progress = readProgress(new Workspace(root, false), readConfig(root).config);

  io.out(args.json ? JSON.stringify(progress, null, 2) : formatProgress(progress));

  return 0;
};
