/** What a merge should hold of one line, from its counts at the base and on each side. */
export interface ThreeWayCount {
  /** The count the result should have: the base, plus what either side added, minus what either removed. */
  readonly expected: number;
  /** What the sides removed: a line above the expected count is then brought back, not written by the merge. */
  readonly removed: number;
  /** The side a missing occurrence comes from: the one that added it, else `both` (both kept it). */
  readonly addedBy: 'ours' | 'theirs' | 'both';
  /** The side that removed it, for a line brought back. */
  readonly removedBy: 'ours' | 'theirs';
}

/**
 * The expected count of a line in a merge. A line both sides added counts once (the larger of
 * the two additions), as git merges two identical additions into one; a line both sides removed
 * goes once in the same way; additions and removals of different sides add up.
 */
export function threeWayCount(base: number, ours: number, theirs: number): ThreeWayCount {
  const byOurs = ours - base;
  const byTheirs = theirs - base;
  const added = byOurs > 0 && byTheirs > 0 ? Math.max(byOurs, byTheirs) : Math.max(byOurs, 0) + Math.max(byTheirs, 0);

  const removed =
    byOurs < 0 && byTheirs < 0 ? Math.max(-byOurs, -byTheirs) : Math.max(-byOurs, 0) + Math.max(-byTheirs, 0);

  return {
    expected: base + added - removed,
    removed,
    addedBy: byOurs > 0 ? 'ours' : byTheirs > 0 ? 'theirs' : 'both',
    removedBy: byOurs < 0 ? 'ours' : 'theirs',
  };
}
