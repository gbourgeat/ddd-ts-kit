import { CliError } from '../cli-error.js';
import { readSlices } from '../progress/read-slices.js';
import { formatStoryPhases } from '../stories/format-story-phases.js';
import { readStoryPhases } from '../stories/read-story-phases.js';
import { readStoryPlace } from '../stories/read-story-place.js';
import { STORY_GATES, type StoryGate } from '../stories/story-gate.js';
import { Workspace } from '../workspace/index.js';
import { Arguments } from './arguments.js';
import type { Command } from './command.js';

/**
 * Where a story stands, phase by phase: specification, rows, design review, acceptance written and
 * locked, rows done, acceptance passing, report; and the next step. In the worktree of a story,
 * the story is the one it takes. `--gate build` exits 1 until the code of the story may start,
 * `--gate close` until it may go to its pull request. Reads, never writes.
 */
export const storyCommand: Command = (argv, io) => {
  const args = Arguments.parse(argv, { gate: { type: 'string' } });
  const root = args.projectRoot;
  const story = storyAsked(root, args.positionals[0]);
  const gate = gateOf(args.text('gate'));
  const phases = readStoryPhases(new Workspace(root, false), story, readSlices(new Workspace(root, false)) ?? []);
  const met = phases.filter((phase) => gate === 'close' || phase.gate === 'build').every((phase) => phase.met);

  io.out(
    args.json
      ? JSON.stringify(
          { story, gate: gate ?? null, met, next: phases.find((phase) => !phase.met)?.next ?? null, phases },
          null,
          2,
        )
      : formatStoryPhases(story, phases, gate),
  );

  return gate !== undefined && !met ? 1 : 0;
};

/** The story named, or the one of the worktree. */
function storyAsked(root: string, named: string | undefined): string {
  const story = named ?? readStoryPlace(root)?.story;

  if (story === undefined) {
    throw new CliError(
      'Which story? This is not the worktree of a story.',
      'Name it (`npx ddd-ts-kit story US5`), or run it from the worktree `npx ddd-ts-kit story-scope US5` opened.',
    );
  }

  return story;
}

function gateOf(text: string | undefined): StoryGate | undefined {
  if (text === undefined) {
    return undefined;
  }

  const gate = STORY_GATES.find((known) => known === text);

  if (gate === undefined) {
    throw new CliError(`Unknown gate "${text}".`, `Pass --gate ${STORY_GATES.join(' or --gate ')}.`);
  }

  return gate;
}
