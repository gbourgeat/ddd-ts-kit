import { CliError } from '../cli-error';
import { formatPlan } from '../plan/format-plan';
import { plannedWords } from '../plan/planned-words';
import { planWaves } from '../plan/plan-waves';
import type { WavePlan } from '../plan/wave-plan';
import { readSlices, SLICES_FILE } from '../progress/read-slices';
import type { Slice } from '../progress/slice';
import { Workspace } from '../workspace';
import { Arguments } from './arguments';
import type { Command } from './command';
import { generate } from './generate';
import type { Io } from './io';

/**
 * Orders the rows of the slices file not done, of the project or of one context, in waves cut
 * into batches of one or two rows, with the command that briefs each batch and the order of the
 * merges. Exits 1, without waves, while a cycle, an unknown dependency or a row without owner
 * keeps the rows from being ordered, or while a planned command, replayed in a copy of the
 * project, introduces a name the glossary of its context does not hold.
 */
export const planWavesCommand: Command = (argv, io) => {
  const args = Arguments.parse(argv, {});
  const root = args.projectRoot;
  const rows = readSlices(new Workspace(root, false));

  if (rows === undefined) {
    throw new CliError(
      `${SLICES_FILE} has no slices table.`,
      'Plan the slices first (the skill ddd-ts-kit:plan-slices writes the table), then run plan-waves again.',
    );
  }

  const context = contextOf(rows, args.positionals[0]);
  const plan = withWords(root, rows, planWaves(rows, { context }));

  io.out(args.json ? JSON.stringify(plan, null, 2) : formatPlan(plan));

  return plan.problems.length === 0 ? 0 : 1;
};

/** The plan, once the rows can be ordered, with what the replay of its commands found: no waves while a name is refused. */
function withWords(root: string, rows: readonly Slice[], plan: WavePlan): WavePlan {
  if (plan.problems.length > 0) {
    return plan;
  }

  const words = plannedWords(root, rows, {
    context: plan.context,
    generate: (argv, language) => void generate(argv, SILENT, language),
  });

  return words.problems.length === 0
    ? { ...plan, notReplayed: words.notReplayed }
    : {
        ...plan,
        problems: words.problems,
        waves: [],
        mergeOrder: [],
        otherStories: [],
        notReplayed: words.notReplayed,
      };
}

/** The replayed commands print nothing: their report would describe a copy of the project. */
const SILENT: Io = { out: () => undefined, err: () => undefined };

/** The context asked for, which a row of the file must name; null when none is. */
function contextOf(rows: readonly Slice[], asked: string | undefined): string | null {
  if (asked === undefined) {
    return null;
  }

  const contexts = [...new Set(rows.map((row) => row.context))].sort();

  if (!contexts.includes(asked)) {
    throw new CliError(`No row of ${SLICES_FILE} is in the context "${asked}".`, `Use one of: ${contexts.join(', ')}.`);
  }

  return asked;
}
