import type { BaselineMove } from './baseline-move';
import { baselineFollowingMoves } from './baseline-following-moves';
import { baselineText } from './baseline-text';
import { parseBaseline } from './parse-baseline';

/** The text of the baseline once files moved, or nothing when the project has none or no moved file is in it. */
export function movedBaselineText(text: string | undefined, moves: readonly BaselineMove[]): string | undefined {
  if (text === undefined) {
    return undefined;
  }

  const baseline = parseBaseline(text);
  const followed = baselineFollowingMoves(baseline, moves);

  return moves.some(({ from }) => baseline[from] !== undefined) ? baselineText(followed) : undefined;
}
