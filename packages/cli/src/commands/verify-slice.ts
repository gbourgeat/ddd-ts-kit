import { CliError } from '../cli-error.js';
import { readConfig } from '../config/index.js';
import { formatSliceVerification } from '../slice/format-slice-verification.js';
import { verifySlice } from '../slice/verify-slice.js';
import { Arguments } from './arguments.js';
import type { Command } from './command.js';
import { knownContext } from './known-context.js';

/** Closes a slice before its commit in one command: regenerate, check the changed files, test the context. */
export const verifySliceCommand: Command = (argv, io) => {
  const args = Arguments.parse(argv, { since: { type: 'string' } });
  const root = args.projectRoot;
  const { config } = readConfig(root);
  const context = knownContext(config, args.positionals[0]);
  const since = args.text('since');

  if (since === undefined) {
    throw new CliError(
      'verify-slice checks the files changed since the trunk of the slice.',
      `Name it: \`ddd-ts-kit verify-slice ${context} --since origin/main\` (the trunk of your briefing).`,
    );
  }

  const verification = verifySlice({ root, config, context, since });

  io.out(args.json ? JSON.stringify(verification, null, 2) : formatSliceVerification(verification));

  return verification.ok ? 0 : 1;
};
