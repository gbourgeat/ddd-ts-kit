import { CliError } from '../cli-error.js';
import type { Workspace } from '../workspace/index.js';
import type { AcceptanceLock, Amendment } from './acceptance-lock.js';
import { countsFor } from './counts-for.js';
import { driftOf } from './drift.js';
import { lockFileOf } from './lock-file-of.js';
import { readLock } from './read-lock.js';
import type { StoryAcceptance } from './story-acceptance.js';

/** What locking judges again itself, or lets through: the lock is what it writes. */
const LEFT_TO_THE_LOCK = new Set(['unlocked', 'drift', 'done-pending']);

/** What to lock: the acceptance of the story as read, the reason of the amendments, and the day. */
export interface LockRequest {
  readonly story: StoryAcceptance;
  readonly reason: string | undefined;
  /** The date the amendments carry, `YYYY-MM-DD`. */
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
 * written (an it.todo, a slice row or a criterion without a scenario), and, when a locked scenario
 * changed although no criterion it proves did, unless a reason is given: the reason is kept as an
 * amendment, which `acceptance` lists for the owner to validate.
 */
export function lockAcceptance(ws: Workspace, request: LockRequest): Locked {
  const { story } = request;

  requireWritten(story);

  const previous = readLock(ws, story.story);
  const amendments = amendmentsOf(previous, request);
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

/** The amendments a reason explains: refused without one while a locked scenario drifted. */
function amendmentsOf(previous: AcceptanceLock | undefined, { story, reason, on }: LockRequest): Amendment[] {
  const unexplained = previous === undefined ? [] : driftOf(previous, story.scenarios, story.criteria).unexplained;

  if (unexplained.length > 0 && (reason === undefined || reason.trim() === '')) {
    throw new CliError(
      `Locked scenarios of ${story.story} changed while no criterion they prove did: ${unexplained.map(({ title }) => `"${title}"`).join(', ')}.`,
      `Restore them as locked; or, when the specification changed, write the new criterion in ${story.specification ?? 'the specification of the story'} first; or, when a scenario did not match its criterion, lock with --reason "<how it failed its criterion>": the reason is kept and reported for the owner to validate. Never to make a test pass.`,
    );
  }

  return unexplained.map(
    (locked): Amendment => ({ scenario: locked.title, criteria: locked.criteria, reason: (reason ?? '').trim(), on }),
  );
}
