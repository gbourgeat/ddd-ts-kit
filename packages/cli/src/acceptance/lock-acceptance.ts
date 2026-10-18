import { CliError } from '../cli-error.js';
import type { Workspace } from '../workspace/index.js';
import type { AcceptanceLock, Amendment } from './acceptance-lock.js';
import { countsFor } from './counts-for.js';
import { driftOf } from './drift.js';
import { lockFileOf } from './lock-file-of.js';
import { readLock } from './read-lock.js';
import { readVerdicts } from './read-verdicts.js';
import type { StoryAcceptance } from './story-acceptance.js';
import { verdictOn } from './verdict-on.js';

/** What locking judges again itself, or lets through: the lock is what it writes. */
const LEFT_TO_THE_LOCK = new Set(['unlocked', 'drift', 'done-pending']);

/** What to lock: the acceptance of the story as read, and the day the amendments carry. */
export interface LockRequest {
  readonly story: StoryAcceptance;
  /** `YYYY-MM-DD`. */
  readonly on: string;
}

/** What a lock wrote: the file and the amendments this lock added. */
export interface Locked {
  readonly file: string;
  readonly scenarios: number;
  readonly amendments: readonly Amendment[];
}

/**
 * Records the scenarios and the criteria of a story as agreed. Refused while the scenarios are not
 * written (an it.todo, a slice row or a criterion without a scenario), and while a change since the
 * previous lock that only a verdict lets through (a criterion changed, a scenario changed while its
 * criteria were not) has no `amend` verdict of the acceptance-judge agent for its very version: the
 * verdicts become amendments of the lock, which `acceptance` lists for the owner to validate.
 */
export function lockAcceptance(ws: Workspace, request: LockRequest): Locked {
  const { story } = request;

  requireWritten(story);

  const previous = readLock(ws, story.story);
  const amendments = amendmentsOf(ws, previous, request);
  const written = story.scenarios.filter(({ state }) => state === 'pending' || state === 'active');

  const lock: AcceptanceLock = {
    story: story.story,
    criteria: Object.fromEntries(story.criteria.map(({ id, fingerprint }) => [id, fingerprint])),
    scenarios: written.map(({ title, criteria, fingerprint }) => ({ title, criteria, fingerprint })),
    amendments: [...(previous?.amendments ?? []), ...amendments],
  };

  const file = lockFileOf(story.story);

  ws.update(file, `${JSON.stringify(lock, null, 2)}\n`);

  return { file, scenarios: written.length, amendments };
}

function requireWritten(story: StoryAcceptance): void {
  const blocking = story.problems.filter(
    (problem) => countsFor(problem, 'written') && !LEFT_TO_THE_LOCK.has(problem.kind),
  );

  if (story.file === undefined || blocking.length > 0) {
    throw new CliError(
      `The acceptance of ${story.story} is not written yet:\n${blocking.map((problem) => `  ${problem.at}  ${problem.message}`).join('\n')}`,
      `Write every scenario, then lock: \`npx ddd-ts-kit acceptance ${story.story} --gate written\` lists what is left.`,
    );
  }
}

/** The changes since the previous lock with their `amend` verdicts; refused while one has none. */
function amendmentsOf(ws: Workspace, previous: AcceptanceLock | undefined, { story, on }: LockRequest): Amendment[] {
  const changes = previous === undefined ? [] : driftOf(previous, story.scenarios, story.criteria).toJudge;
  const verdicts = readVerdicts(ws, story.story);
  const unjudged = changes.filter((change) => verdictOn(change, verdicts)?.verdict !== 'amend');

  if (unjudged.length > 0) {
    throw new CliError(
      `Changed since the lock without a verdict that lets it through: ${unjudged.map((change) => `${change.subject} (fingerprint ${change.fingerprint})`).join(', ')}.`,
      'Restore each as locked; or launch the acceptance-judge agent on each, with its subject and fingerprint, and lock again once it wrote `Verdict: amend`. Never change an acceptance test to make code pass.',
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
