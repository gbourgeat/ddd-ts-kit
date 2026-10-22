import type { AppliedMoves } from './applied-moves';
import type { OnLeft } from './concept-leftovers';
import { legacyMove } from './legacy-move';
import { rewriteConceptUsages } from './rewrite-concept-usages';
import { rewriteUsages } from './rewrite-usages';

/**
 * A file where the refusals are named by their classes of their own: the classes per error as
 * `rewriteUsages` renames them, the factories of the concept classes as `rewriteConceptUsages`
 * replaces them. What still names a concept class that is `gone` is told.
 */
export function rewriteNamedUsages(
  source: string,
  { moves, gone }: AppliedMoves,
  onLeft: OnLeft = () => undefined,
): string {
  const legacy = moves.filter((move) => move.oldFactory === undefined).map(legacyMove);
  const concept = moves.filter((move) => move.oldFactory !== undefined);

  return rewriteConceptUsages(rewriteUsages(source, legacy), { moves: concept, gone }, onLeft);
}
