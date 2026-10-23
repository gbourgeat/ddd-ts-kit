import { readConfig } from '../config';
import { describeContext } from '../describe/describe-context';
import { formatDescription } from '../describe/format-description';
import { readContext } from '../docs/read-context';
import { Workspace } from '../workspace';
import { Arguments } from './arguments';
import type { Command } from './command';
import { knownContext } from './known-context';

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
