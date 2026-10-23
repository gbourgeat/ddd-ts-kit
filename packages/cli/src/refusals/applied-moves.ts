import type { NamedMove } from './named-move';

/** The moves a plan to the named form made, and the concept classes they left empty, which nothing may name any more. */
export interface AppliedMoves {
  readonly moves: readonly NamedMove[];
  readonly gone: ReadonlySet<string>;
}
