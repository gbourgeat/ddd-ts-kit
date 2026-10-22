import { CliError } from '../cli-error';
import { formatStoryClosing } from '../story/format-story-closing';
import { readStoryClosing } from '../story/read-story-closing';
import { Arguments } from './arguments';
import type { Command } from './command';

/**
 * Says whether a story or a milestone can close: every row of it done in the slices file, no
 * marker of its own left (named by its text, written by a commit of one of its rows, or alone in
 * a context no other open story works in), and no done row departed from its design review
 * without the report listing the compromise; with `--strict`, no marker at all in its contexts.
 * Reads only. Exits 1 while something keeps it open, 2 on a code no row carries or without slices file.
 */
export const storyCheckCommand: Command = (argv, io) => {
  const args = Arguments.parse(argv, { strict: { type: 'boolean', default: false } });
  const [story] = args.positionals;

  if (story === undefined) {
    throw new CliError(
      'story-check takes the code of a story or a milestone.',
      'Name it as the ids of its rows start: `npx ddd-ts-kit story-check M1` for the rows M1.01, M1.02, ...',
    );
  }

  const closing = readStoryClosing(args.projectRoot, story, args.flag('strict'));

  io.out(args.json ? JSON.stringify(closing, null, 2) : formatStoryClosing(closing));

  return closing.canClose ? 0 : 1;
};
