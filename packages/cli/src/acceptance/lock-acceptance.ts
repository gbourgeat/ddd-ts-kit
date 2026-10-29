import { CliError } from '../cli-error';
import { formatJson } from '../json/format-json';
import type { Workspace } from '../workspace';
import type { AcceptanceLock, Amendment, LockedTest } from './acceptance-lock';
import type { AcceptanceProblem } from './acceptance-problem';
import { countsFor } from './counts-for';
import { driftOf, type Judged } from './drift';
import { lockFileOf } from './lock-file-of';
import { type PreviousLock, previousLockOf } from './previous-lock-of';
import { readVerdicts } from './read-verdicts';
import { regressionDriftOf } from './regression-drift-of';
import type { StoryAcceptance } from './story-acceptance';
import { verdictOn } from './verdict-on';

/** What locking judges again itself, or lets through: the lock is what it writes. */
const LEFT_TO_THE_LOCK = new Set(['unlocked', 'drift', 'done-pending']);

/** What to lock: the acceptance of the story as read, and the day the amendments carry. */
export interface LockRequest {
  readonly story: StoryAcceptance;
  /** `YYYY-MM-DD`. */
  readonly on: string;
}

/** What a lock wrote: the file, how many scenarios and regression tests, and the amendments this lock added. */
export interface Locked {
  readonly file: string;
  readonly scenarios: number;
  readonly tests: number;
  readonly amendments: readonly Amendment[];
  /** What the lock could not check, said once. */
  readonly notes: readonly string[];
}

/**
 * Records the scenarios and the criteria of a story as agreed, or the regression tests of a fix.
 * Refused while the scenarios are not written (an it.todo, a slice row or a criterion without a
 * scenario; for a fix, a listed spec missing or without a test), and while a change since the
 * previous lock that only a verdict lets through (a criterion changed, a scenario or a regression
 * test changed while its criteria were not) has no `amend` verdict of the acceptance-judge agent
 * for its very version: the verdicts become amendments of the lock, which `acceptance` lists for
 * the owner to validate.
 */
export function lockAcceptance(ws: Workspace, request: LockRequest): Locked {
  const { story } = request;

  requireWritten(story);

  const found = previousLockOf(ws, story.story);
  const previous = 'lock' in found ? found.lock : undefined;
  const amendments = amendmentsOf(ws, found, request);
  const written = story.scenarios.filter(({ state }) => state === 'pending' || state === 'active');
  const tests = lockedTests(story);

  const lock: AcceptanceLock = {
    story: story.story,
    criteria: Object.fromEntries(story.criteria.map(({ id, fingerprint }) => [id, fingerprint])),
    scenarios: written.map(({ title, criteria, fingerprint }) => ({ title, criteria, fingerprint })),
    regression: tests,
    amendments: [...(previous?.amendments ?? []), ...amendments],
  };

  const file = lockFileOf(story.story);

  ws.update(file, formatJson(lock));

  const notes = notesOf(found, story.story);

  return { file, scenarios: written.length, tests: tests.length, amendments, notes };
}

/** The regression tests of a fix as the lock records them: each written test of each listed spec. */
function lockedTests(story: StoryAcceptance): LockedTest[] {
  return (story.regression ?? []).flatMap((spec) =>
    spec.tests
      .filter(({ state }) => state === 'pending' || state === 'active')
      .map(({ title, fingerprint }) => ({ file: spec.file, title, fingerprint })),
  );
}

function requireWritten(story: StoryAcceptance): void {
  const blocking = story.problems.filter(
    (problem) => countsFor(problem, 'written') && !LEFT_TO_THE_LOCK.has(problem.kind),
  );

  if (story.regression !== undefined) {
    requireRegression(story, blocking);

    return;
  }

  if (story.file === undefined || blocking.length > 0) {
    throw new CliError(
      `The acceptance of ${story.story} is not written yet:\n${blocking.map((problem) => `  ${problem.at}  ${problem.message}`).join('\n')}`,
      `Write every scenario, then lock: \`npx ddd-ts-kit acceptance ${story.story} --gate written\` lists what is left.`,
    );
  }
}

/** A fix locks its regression tests: each listed spec there, with a test, none left to write. */
function requireRegression(story: StoryAcceptance, blocking: readonly AcceptanceProblem[]): void {
  if (lockedTests(story).length > 0 && blocking.length === 0) {
    return;
  }

  const left =
    blocking.length === 0
      ? `  docs/architecture/stories/${story.story}.md  \`## Regression\` lists no spec file.`
      : blocking.map((problem) => `  ${problem.at}  ${problem.message}`).join('\n');

  throw new CliError(
    `The regression of ${story.story} is not written yet:\n${left}`,
    `Write the failing spec, list it under \`## Regression\` of its story file, then lock: \`npx ddd-ts-kit acceptance ${story.story} --gate written\` lists what is left.`,
  );
}

/** The changes since the previous lock with their `amend` verdicts; refused while one has none. */
function amendmentsOf(ws: Workspace, found: PreviousLock, { story, on }: LockRequest): Amendment[] {
  const lock = 'lock' in found ? found.lock : undefined;

  const changes =
    lock === undefined
      ? []
      : [
          ...driftOf(lock, story.scenarios, story.criteria).toJudge,
          ...regressionDriftOf(lock.regression, story.regression ?? []).toJudge,
        ];

  const verdicts = readVerdicts(ws, story.story);
  const unjudged = changes.filter((change) => verdictOn(change, verdicts)?.verdict !== 'amend');

  if (unjudged.length > 0 && found.kind === 'committed') {
    throw removedLockRefusal(story.story, found.commit, unjudged);
  }

  if (unjudged.length > 0) {
    throw new CliError(
      `Changed since the lock without a verdict that lets it through: ${unjudged.map((change) => `${change.subject} (fingerprint ${change.fingerprint})`).join(', ')}.`,
      'Restore each as locked; or launch the acceptance-judge agent on each, with its subject and fingerprint, and lock again once it wrote `Verdict: amend`. Never change an acceptance test, nor the regression test of a fix, to make code pass.',
    );
  }

  return changes.map((change): Amendment => {
    const verdict = verdictOn(change, verdicts);

    return {
      subject: change.subject,
      criteria: change.criteria,
      reason: verdict?.reason ?? '',
      verdict: verdict?.file ?? '',
      on,
    };
  });
}

/** What the lock could not check, or decided not to compare with, said once. */
function notesOf(found: PreviousLock, story: string): string[] {
  if (found.kind === 'unchecked') {
    return [
      `The previous lock of ${story} could not be checked: git did not answer (no repository, or git not installed).`,
    ];
  }

  return found.kind === 'deleted'
    ? [`The lock of ${story} was removed by the commit ${found.commit.slice(0, 8)}: locked again without comparison.`]
    : [];
}

function removedLockRefusal(story: string, commit: string, unjudged: readonly Judged[]): CliError {
  return new CliError(
    `The lock of ${story} was removed or emptied, and changed since its last commit without a verdict that lets it through: ${unjudged.map((change) => `${change.subject} (fingerprint ${change.fingerprint})`).join(', ')}.`,
    `Restore it (\`git checkout ${commit.slice(0, 8)} -- ${lockFileOf(story)}\`), then let the acceptance-judge agent rule on each change with its subject and fingerprint, and lock again once it wrote \`Verdict: amend\`.`,
  );
}
