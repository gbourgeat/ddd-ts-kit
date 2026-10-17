import { ACCEPTANCE_GATES, type AcceptanceGate } from '../acceptance/acceptance-gate.js';
import { countsFor } from '../acceptance/counts-for.js';
import { formatAcceptance } from '../acceptance/format-acceptance.js';
import { lockAcceptance } from '../acceptance/lock-acceptance.js';
import { readAcceptance } from '../acceptance/read-acceptance.js';
import type { StoryAcceptance } from '../acceptance/story-acceptance.js';
import { CliError } from '../cli-error.js';
import { readSlices } from '../progress/read-slices.js';
import { Workspace } from '../workspace/index.js';
import { Arguments } from './arguments.js';
import type { Command } from './command.js';
import type { Io } from './io.js';

/**
 * The acceptance scenarios of each story against its rows in slices.md and the criteria of its
 * specification: which rows and criteria a scenario covers, which scenarios are left to write or
 * wait for their code, which changed since the lock, and what is inconsistent. `--gate written` is
 * what a story needs before the code of its rows, `--gate passing` before it closes; `--lock`
 * records the scenarios as agreed. Never runs a test; exits 1 while something keeps a story from
 * the gate asked, or, without one, while a scenario is inconsistent or drifted from its lock.
 */
export const acceptanceCommand: Command = (argv, io) => {
  const args = Arguments.parse(argv, {
    gate: { type: 'string' },
    lock: { type: 'boolean', default: false },
    reason: { type: 'string' },
  });

  const ws = new Workspace(args.projectRoot, false);
  const gate = gateOf(args.text('gate'));
  const [asked] = args.positionals;
  const stories = readAcceptance(ws, readSlices(ws) ?? [], asked);

  if (asked !== undefined && stories.length === 0) {
    throw new CliError(
      `${asked} is neither a story of docs/architecture/slices.md nor the name of a spec of test/acceptance/.`,
      'Pass the code of a story as its rows start (`US5` for `US5.03`); `npx ddd-ts-kit status` lists the rows.',
    );
  }

  if (args.flag('lock') || args.text('reason') !== undefined) {
    return lock(ws, { asked, story: stories[0], reason: args.text('reason'), json: args.json }, io);
  }

  const failing = stories.some((story) => story.problems.some((problem) => countsFor(problem, gate)));

  io.out(
    args.json
      ? JSON.stringify({ gate: gate ?? null, met: !failing, stories }, null, 2)
      : formatAcceptance(stories, gate),
  );

  return failing ? 1 : 0;
};

interface LockRequest {
  readonly asked: string | undefined;
  readonly story: StoryAcceptance | undefined;
  readonly reason: string | undefined;
  readonly json: boolean;
}

function lock(ws: Workspace, { asked, story, reason, json }: LockRequest, io: Io): number {
  if (asked === undefined || story === undefined) {
    throw new CliError('--lock locks the acceptance of one story.', 'Name it: `npx ddd-ts-kit acceptance US5 --lock`.');
  }

  const locked = lockAcceptance(ws, { story, reason, on: new Date().toISOString().slice(0, 10) });

  ws.commit(false);

  io.out(
    json
      ? JSON.stringify({ story: story.story, ...locked }, null, 2)
      : [
          `Locked ${locked.scenarios} scenario${locked.scenarios === 1 ? '' : 's'} of ${story.story} in ${locked.file}: commit it with them.`,
          ...locked.amendments.map(
            (amendment) => `Amended, for the owner to validate: "${amendment.scenario}": ${amendment.reason}`,
          ),
        ].join('\n'),
  );

  return 0;
}

function gateOf(text: string | undefined): AcceptanceGate | undefined {
  if (text === undefined) {
    return undefined;
  }

  const gate = ACCEPTANCE_GATES.find((known) => known === text);

  if (gate === undefined) {
    throw new CliError(`Unknown gate "${text}".`, `Pass --gate ${ACCEPTANCE_GATES.join(' or --gate ')}.`);
  }

  return gate;
}
