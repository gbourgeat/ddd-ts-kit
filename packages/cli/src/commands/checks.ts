import { checkCommand } from '../check/commands/check-command';
import type { Command } from './command';
import { commitSizeCommand } from './commit-size';

/** `check`: the architecture rules, or with `--commit-size` the size of the commit in progress. */
export const checksCommand: Command = (argv, io) =>
  argv.includes('--commit-size') ? commitSizeCommand(argv, io) : checkCommand(argv, io);
