import { collapsedFiles } from './collapsed-files.js';
import { lostLines } from './lost-lines.js';
import type { MergeFinding } from './merge-finding.js';
import type { MergeSides } from './merge-sides.js';
import { rewrittenInPlace } from './rewritten-in-place.js';
import { type SideChanges, supersededLines } from './superseded-lines.js';

/** The hunks of each side against the base, and from each side to the result. */
export interface MergeChanges {
  readonly fromBase: SideChanges;
  readonly toResult: SideChanges;
}

/**
 * The line findings of a merge: the lines it lost or brought back; as warnings, those one side
 * wrote where the other changed the same lines and those the merge replaced by lines of its own;
 * a file the merge deleted as one finding.
 */
export function lineFindings(sides: MergeSides, changes: MergeChanges): MergeFinding[] {
  const lost = supersededLines(lostLines(sides), sides, changes.fromBase);

  return collapsedFiles(rewrittenInPlace(lost, sides, changes.toResult), sides);
}
