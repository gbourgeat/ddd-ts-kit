import { findKind } from '../generate/find-kind';
import { toName } from '../naming';
import type { Slice } from '../progress/slice';
import type { Replay } from './replay';
import type { RefusedCommand } from './wave-plan';

/** The status of a row its worker has started: its commands may have run in the project already. */
const STARTED = 'in progress';

/**
 * The refusal of the command replayed at `at`, as a problem of the plan, unless its row is in
 * progress: a worker following the row as written would meet it. A row in progress is replayed so
 * that the rows after it find what it generates, but its refusals are not problems: its commands
 * may have run already, and the generator refuses a second run of some of them (a port already
 * bound to an adapter, a decision record whose number is taken).
 */
export function refusedCommand(replays: readonly Replay[], at: number): RefusedCommand[] {
  const replay = replays[at];

  if (replay?.refusal === undefined || replay.row.status === STARTED) {
    return [];
  }

  const { row, command, refusal } = replay;
  const builtOn = refusal.missing === null ? undefined : prerequisiteOf(refusal.missing, { replays, at });
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
        .join(' '),
    },
  ];
}

/** Where the plan stands on what a refused command builds on. */
interface BuiltOn {
  readonly sentence: string;
  /** The row that generates it and that the refused row should wait for. */
  readonly by: string | undefined;
}

/** The replayed commands, in their order, and the index of the refused one. */
interface Place {
  readonly replays: readonly Replay[];
  readonly at: number;
}

/**
 * Which row generates what is missing, `missing` being the command that creates it: one the
 * replay runs later, which the row does not wait for since it would have run before; one the
 * generator refuses too; none.
 */
function prerequisiteOf(missing: string, { replays, at }: Place): BuiltOn | undefined {
  const wanted = keyOf(missing.replace(/^ddd-ts-kit generate /, '').split(' '));
  const row = replays[at]?.row;

  if (wanted === undefined || row === undefined) {
    return undefined;
  }

  const index = replays.findIndex((replay) => keyOf(replay.argv) === wanted);
  const generator = replays[index];

  if (generator === undefined) {
    return {
      sentence: 'No row of the plan generates it: add that command to this row, or to a row it depends on.',
      by: undefined,
    };
  }

  return index > at ? later(generator, row) : earlier(generator, row);
}

function later(generator: Replay, row: Slice): BuiltOn {
  return generator.row === row
    ? { sentence: `A later command of this row generates it: put \`${generator.command}\` first.`, by: undefined }
    : waitedFor(generator.row.id, row);
}

/** Run before, it was refused, or wrote elsewhere than where the command looks. */
function earlier(generator: Replay, row: Slice): BuiltOn {
  const who = generator.row === row ? 'An earlier command of this row' : `#${generator.row.id}`;

  return {
    sentence:
      generator.refusal === undefined
        ? `${who} generates it, but not where this command looks for it: give both commands the same --module.`
        : `${who} would generate it, but the generator refuses that command too: fix it first.`,
    by: undefined,
  };
}

function waitedFor(id: string, row: Slice): BuiltOn {
  return { sentence: `#${id} generates it, but #${row.id} does not wait for it: add ${id} to its Depends on.`, by: id };
}

/** `aggregate billing Invoice` for the arguments of a command that generates the aggregate Invoice of billing. */
function keyOf([kindName = '', context = '', name = '']: readonly string[]): string | undefined {
  const kind = findKind(kindName);

  return kind === undefined || context === '' || name === ''
    ? undefined
    : `${kind.name} ${toName(context).kebab} ${toName(name).pascal}`;
}
