import type { Slice } from '../progress/slice';
import type { Replay } from './replay';
import { isStarted } from './is-started';
import type { ReplayedPlan } from './replayed-plan';
import type { RefusedCommand } from './wave-plan';

/** Runs a replayed command again, once the whole plan has run in the copy. */
type Again = (replay: Replay) => Replay;

/**
 * The refusal of the command replayed at `at`, as a problem of the plan, unless its row is in
 * progress: a worker following the row as written would meet it. A row in progress is replayed so
 * that the rows after it find what it generates, but its refusals are only said: its commands may
 * have run already, and the generator refuses a second run of some of them (a port already bound
 * to an adapter, a decision record whose number is taken). A command refused for what it builds
 * on is run again once the whole plan has: the files it then finds say which row generates them.
 */
export function refusedCommand(plan: ReplayedPlan, at: number, again: Again): RefusedCommand[] {
  const replay = plan.replays[at];

  if (replay?.refusal === undefined || isStarted(replay.row)) {
    return [];
  }

  const { row, command, refusal } = replay;
  const builtOn = refusal.missing ? prerequisiteOf(plan, at, again(replay)) : undefined;
  const prerequisite = builtOn?.sentence ?? null;

  return [
    {
      kind: 'refused-command',
      rows: builtOn?.by === undefined ? [row.id] : [row.id, builtOn.by],
      command,
      refusal: refusal.message,
      fix: refusal.fix,
      prerequisite,
      message: [`#${row.id} \`${command}\` is refused by the generator:`, refusal.message, refusal.fix, prerequisite]
        .filter((part) => part !== null)
        .join(' ')
        .replace(/\s*\n\s*/g, ' '),
    },
  ];
}

/** Where the plan stands on what a refused command builds on. */
interface BuiltOn {
  readonly sentence: string;
  /** The row that generates it and that the refused row should wait for. */
  readonly by: string | undefined;
}

/**
 * The row that generates what the command found when run again, `rerun`: a later command of the
 * same row, a row that does not wait for it, or one that does, whose command has to move. None
 * when it is still refused for what it builds on.
 */
function prerequisiteOf(plan: ReplayedPlan, at: number, rerun: Replay): BuiltOn | undefined {
  const later = rerun.builtOn.flatMap((file) => {
    const by = plan.creatorOf(file);
    const creator = by === undefined || by <= at ? undefined : plan.replays[by];

    return creator === undefined ? [] : [{ file, creator }];
  });

  const [first] = later;

  if (first === undefined) {
    return rerun.refusal?.missing === true
      ? {
          sentence:
            'No row of the plan generates it: add the command the fix names to this row, or to a row it depends on.',
          by: undefined,
        }
      : undefined;
  }

  return generatedLater(plan, rerun.row, first);
}

interface Generated {
  readonly file: string;
  readonly creator: Replay;
}

function generatedLater(plan: ReplayedPlan, row: Slice, { file, creator }: Generated): BuiltOn {
  const by = creator.row;

  if (by === row) {
    return {
      sentence: `A later command of this row generates \`${file}\`: put \`${creator.command}\` first.`,
      by: undefined,
    };
  }

  return plan.waitsFor(by, row)
    ? {
        sentence: `#${by.id} generates \`${file}\`, but it waits for #${row.id}: move \`${creator.command}\` to #${row.id}, or to a row #${row.id} depends on.`,
        by: undefined,
      }
    : {
        sentence: `#${by.id} generates \`${file}\`, but #${row.id} does not wait for it: add ${by.id} to its Depends on.`,
        by: by.id,
      };
}
