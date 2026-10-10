import { readConfig } from '../config/index.js';
import { formatCommitSize } from '../commit/format-commit-size.js';
import { measureCommit } from '../commit/measure-commit.js';
import { Arguments } from './arguments.js';
import type { Command } from './command.js';

/** `check --commit-size`: says whether what is about to be committed fits one slice. Advisory unless `--strict`. */
export const commitSizeCommand: Command = (argv, io) => {
  const args = Arguments.parse(argv, {
    'commit-size': { type: 'boolean', default: false },
    staged: { type: 'boolean', default: false },
    strict: { type: 'boolean', default: false },
  });

  const root = args.projectRoot;
  const size = measureCommit(root, readConfig(root).config, args.flag('staged'));

  io.out(args.json ? JSON.stringify(size, null, 2) : formatCommitSize(size));

  return size.over && args.flag('strict') ? 1 : 0;
};
