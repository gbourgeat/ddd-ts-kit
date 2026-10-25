import type { Baseline } from './baseline';
import type { BaselineMove } from './baseline-move';

/**
 * The baseline once files moved: the counts of a moved file go to its new path, never raised, so
 * that moving code into the canonical tree, which adopting the kit is made of, silences nothing new
 * and lets nothing old out.
 */
export function baselineFollowingMoves(baseline: Baseline, moves: readonly BaselineMove[]): Baseline {
  const destination = new Map(
    moves.filter(({ to }) => baseline[to] === undefined).map(({ from, to }) => [from, to] as const),
  );

  return Object.fromEntries(Object.entries(baseline).map(([file, rules]) => [destination.get(file) ?? file, rules]));
}
