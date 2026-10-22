import { formatStories } from '../stories/format-stories';
import { readStories } from '../stories/read-stories';
import { Arguments } from './arguments';
import type { Command } from './command';

/**
 * The stories open in the worktrees of the repository and where they meet: the contexts and the
 * files two of them change, what merging the branch of one into the other would leave to a
 * person, and how far each is behind its trunk. From the worktree of a story, the stories it
 * meets. Reads, never writes.
 */
export const storiesCommand: Command = (argv, io) => {
  const args = Arguments.parse(argv, {});
  const view = readStories(args.projectRoot);

  io.out(args.json ? JSON.stringify(view, null, 2) : formatStories(view, args.projectRoot));

  return 0;
};
