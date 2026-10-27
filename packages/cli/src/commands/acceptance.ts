import { checkLockedFiles } from '../acceptance/check-locked-files';
import { ACCEPTANCE_GATES, type AcceptanceGate } from '../acceptance/acceptance-gate';
import { countsFor } from '../acceptance/counts-for';
import { formatAcceptance } from '../acceptance/format-acceptance';
import { type Locked, lockAcceptance } from '../acceptance/lock-acceptance';
import { readAcceptance } from '../acceptance/read-acceptance';
import type { StoryAcceptance } from '../acceptance/story-acceptance';
import { CliError } from '../cli-error';
import { readSlices } from '../progress/read-slices';
import { exitCodeOf, tellUnwritable, Workspace } from '../workspace';
import { Arguments } from './arguments';
import type { Command } from './command';
import type { Io } from './io';

/**
 * The acceptance scenarios of each story against its rows in slices.md and the criteria of its
 * specification: which rows and criteria a scenario covers, which scenarios are left to write or
 * wait for their code, which changed since the lock, and what is inconsistent. A fix (a story file
 * with a `## Regression` section) is held the same way to the tests of the specs it lists.
 * `--gate written` is what a story needs before the code of its rows, `--gate passing` before it
 * closes; `--lock` records the scenarios, or the regression tests, as agreed. Never runs a test;
 * exits 1 while something keeps a story from the gate asked, or, without one, while a scenario is
 * inconsistent or drifted from its lock.
 */
export const acceptanceCommand: Command = (argv, io) => {
  const args = Arguments.parse(argv, {
    gate: { type: 'string' },
    lock: { type: 'boolean', default: false },
  });

  const ws = new Workspace(args.projectRoot, false);
  const gate = gateOf(args.text('gate'));
  const [asked] = args.positionals;
  const stories = readAcceptance(ws, readSlices(ws) ?? [], asked);

  if (asked !== undefined && stories.length === 0) {
    throw new CliError(
      `${asked} is neither a story of docs/architecture/slices.md, nor the name of a spec of test/acceptance/, nor a fix whose docs/architecture/stories/${asked}.md lists its specs under \`## Regression\`.`,
      'Pass the code of a story as its rows start (`US5` for `US5.03`); `npx ddd-ts-kit status` lists the rows.',
    );
  }

  if (args.flag('lock')) {
    return lock(ws, { asked, story: stories[0], json: args.json }, io);
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
  readonly json: boolean;
}

function lock(ws: Workspace, { asked, story, json }: LockRequest, io: Io): number {
  if (asked === undefined || story === undefined) {
    throw new CliError('--lock locks the acceptance of one story.', 'Name it: `npx ddd-ts-kit acceptance US5 --lock`.');
  }

  const locked = lockAcceptance(ws, { story, on: new Date().toISOString().slice(0, 10) });

  refuseUnchecked(ws, story);

  const report = ws.commit(false);

  if (report.unwritable.length > 0) {
    tellUnwritable(io, report);

    return exitCodeOf(report);
  }

  io.out(
    json
      ? JSON.stringify({ story: story.story, ...locked }, null, 2)
      : [
          `Locked ${lockedWhat(locked)} of ${story.story} in ${locked.file}: commit it with them.`,
          ...locked.amendments.map(
            (amendment) =>
              `Amended by ${amendment.verdict}, for the owner to validate: ${amendment.subject}: ${amendment.reason}`,
          ),
        ].join('\n'),
  );

  return 0;
}

/**
 * A locked file can no longer be touched, so the lock is refused while the files it makes untouchable
 * fail the formatter or the linter of the project: the spec of a story, or the regression specs of a fix.
 */
function refuseUnchecked(ws: Workspace, story: StoryAcceptance): void {
  const files = story.regression?.filter(({ found }) => found).map(({ file }) => file) ?? [story.file ?? ''];
  const named = files.filter((file) => file !== '');
  const checked = checkLockedFiles(ws.root, named);

  if (checked.findings.length > 0) {
    throw new CliError(
      `${named.join(', ')} fails the checks of the project, and a locked file can no longer be changed:\n${checked.findings.join('\n')}`,
      'Run the formatter and the linter on the file, fix what they report (`npm run format`, `npm run lint -- <file>`), then lock again.',
    );
  }
}

/** What a lock recorded: the regression tests of a fix, or the scenarios of a story. */
function lockedWhat({ scenarios, tests }: Locked): string {
  return tests > 0 && scenarios === 0
    ? `${tests} regression test${tests === 1 ? '' : 's'}`
    : `${scenarios} scenario${scenarios === 1 ? '' : 's'}`;
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
