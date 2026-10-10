import { readConfig } from '../config/index.js';
import { describeContext } from '../describe/describe-context.js';
import { formatDescription } from '../describe/format-description.js';
import { readContext } from '../docs/read-context.js';
import { Workspace } from '../workspace/index.js';
import { Arguments } from './arguments.js';
import type { Command } from './command.js';
import { knownContext } from './known-context.js';

/** Prints what one context holds, read from the config and the source text: the facts an agent needs before it opens a file. */
export const describeCommand: Command = (argv, io) => {
  const args = Arguments.parse(argv, {});
  const root = args.projectRoot;
  const { config } = readConfig(root);
  const ws = new Workspace(root, false);
  const description = describeContext(ws, config, readContext(ws, config, knownContext(config, args.positionals[0])));

  io.out(args.json ? JSON.stringify(description, null, 2) : formatDescription(description));

  return 0;
};
