import { trunkExample } from '../commit/trunk-example';
import { CliError } from '../cli-error';
import { readConfig } from '../config';
import { formatDigest, readDigest } from '../digest';
import { stdoutJson } from '../json/stdout-json';
import { Arguments } from './arguments';
import type { Command } from './command';

/**
 * Prints what a branch changes for its reviewer, read before the diff: the use cases, permissions,
 * routes, events and ports each context gains, changes or loses since the base, the new spec
 * titles, and the files in reading order, those the kit regenerates apart.
 */
export const digestCommand: Command = (argv, io) => {
  const args = Arguments.parse(argv, { base: { type: 'string' } });
  const root = args.projectRoot;
  const { config } = readConfig(root);
  const base = args.text('base');

  if (base === undefined || base === '') {
    throw new CliError(
      'digest compares the branch with the commit it was cut from.',
      `Name it: \`ddd-ts-kit digest --base ${trunkExample(root)}\` (the base of the story or of the briefing).`,
    );
  }

  const digest = readDigest(root, base, config);

  io.out(args.json ? stdoutJson(digest) : formatDigest(digest));

  return 0;
};
