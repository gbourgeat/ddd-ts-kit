import path from 'node:path';
import { CliError } from '../cli-error.js';
import { formatPlan } from '../plan/format-plan.js';
import { planWaves } from '../plan/plan-waves.js';
import { readSlices, SLICES_FILE } from '../progress/read-slices.js';
import type { Slice } from '../progress/slice.js';
import { Workspace } from '../workspace/index.js';
import { Arguments } from './arguments.js';
import type { Command } from './command.js';

/**
 * Orders the rows of the slices file not done, of the project or of one context, in waves cut
 * into batches of one or two rows, with the command that briefs each batch and the order of the
 * merges. Exits 1, without waves, while a cycle, an unknown dependency or a row without owner
 * keeps the rows from being ordered.
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

  const plan = planWaves(rows, { context: contextOf(rows, args.positionals[0]), project: path.basename(root) });

  io.out(args.json ? JSON.stringify(plan, null, 2) : formatPlan(plan));

  return plan.problems.length === 0 ? 0 : 1;
};

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
