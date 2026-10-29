import type { Slice } from '../progress/slice';
import type { Refusal, Replay } from './replay';
import { isStarted } from './is-started';
import type { ReplayedPlan } from './replayed-plan';
import type { RefusedCommand } from './wave-plan';

/** Runs a replayed command again, with `--dry-run`, once the whole plan has run in the copy. */
type Again = (replay: Replay) => Replay;

/**
 * The refusal of the command replayed at `at`, as a problem of the plan, unless its row is in
 * progress: a worker following the row as written would meet it. A row in progress is replayed so
 * that the rows after it find what it generates, but its refusals are only said: its commands may
 * have run already, and the generator refuses a second run of some of them (a port already bound
 * to an adapter, a decision record whose number is taken). A command refused for what it builds
 * on is run again once the whole plan has: the files it then finds say which row generates them,
 * and what it is refused then, for another reason, is said too.
 */
export function refusedCommand(plan: ReplayedPlan, at: number, again: Again): RefusedCommand[] {
  const replay = plan.replays[at];

  if (replay?.refusal === undefined || isStarted(replay.row)) {
    return [];
  }

  const { row, command, refusal } = replay;
  const rerun = refusal.missing ? again(replay) : undefined;
  const found = rerun === undefined ? [] : rowsGenerating(plan, at, rerun);
  const { lacking, nextRefusal } = refusedAgain(refusal, rerun);
  const prerequisites = [...found.map(({ sentence }) => sentence), ...lacking];

  const said = {
    command,
    refusal: refusal.message,
    fix: refusal.fix,
    prerequisite: prerequisites.length === 0 ? null : prerequisites.join('\n'),
    nextRefusal,
  };

  return [
    {
      kind: 'refused-command',
      rows: [row.id, ...new Set(found.flatMap(({ by }) => (by === undefined ? [] : [by])))],
      ...said,
      message: messageOf(row, said),
    },
  ];
}

/**
 * What the rerun is refused for: the same file again once the whole plan has run, which no row
 * generates (`lacking`), or another reason or another file, said as the next refusal.
 */
function refusedAgain(
  refusal: Refusal,
  rerun: Replay | undefined,
): { readonly lacking: readonly string[]; readonly nextRefusal: RefusedCommand['nextRefusal'] } {
  const next = rerun?.refusal;

  if (next === undefined) {
    return { lacking: [], nextRefusal: null };
  }

  if (next.missing && next.message === refusal.message) {
    return { lacking: [NO_ROW], nextRefusal: null };
  }

  return {
    lacking: [],
    nextRefusal: { refusal: next.message, fix: next.fix, prerequisite: next.missing ? NO_ROW : null },
  };
}

type Said = Omit<RefusedCommand, 'kind' | 'rows' | 'message'>;

const NO_ROW =
  'No row of the plan generates it as the rows are written: add the command the fix names to this row or to a row it depends on, or fix the refused row that would generate it.';

/** All of it on one line, the lines of a refusal joined. */
function messageOf(row: Slice, { command, refusal, fix, prerequisite, nextRefusal }: Said): string {
  const next =
    nextRefusal === null
      ? []
      : [`Then it is refused again: ${nextRefusal.refusal}`, nextRefusal.fix, nextRefusal.prerequisite];

  return [`#${row.id} \`${command}\` is refused by the generator:`, refusal, fix, prerequisite, ...next]
    .filter((part) => part !== null)
    .join(' ')
    .replace(/\s*\n\s*/g, ' ');
}

/** Where the plan stands on one file a refused command builds on. */
interface BuiltOn {
  readonly sentence: string;
  /** The row that generates it and that the refused row should wait for. */
  readonly by: string | undefined;
}

/**
 * The rows that generate what the command found when run again, `rerun`, each once: a later
 * command of the same row, a later row that does not wait for it, or one that does, whose command
 * has to move.
 */
function rowsGenerating(plan: ReplayedPlan, at: number, rerun: Replay): BuiltOn[] {
  const said = new Set<Slice>();

  return rerun.builtOn.flatMap((file) => {
    const by = plan.creatorOf(file);
    const creator = by === undefined || by <= at ? undefined : plan.replays[by];

    if (creator === undefined || said.has(creator.row)) {
      return [];
    }

    said.add(creator.row);

    return [generatedLater(plan, rerun.row, { file, creator })];
  });
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
