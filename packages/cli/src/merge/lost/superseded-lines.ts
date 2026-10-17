import type { MergeFinding } from './merge-finding.js';
import type { MergeSides } from './merge-sides.js';
import type { Hunk } from './hunk.js';

/** The hunks of each side against the base, file by file. */
export interface SideChanges {
  readonly ours: ReadonlyMap<string, readonly Hunk[]>;
  readonly theirs: ReadonlyMap<string, readonly Hunk[]>;
}

interface Context {
  readonly findings: readonly MergeFinding[];
  readonly sides: MergeSides;
  readonly changes: SideChanges;
}

/**
 * The lost lines that one side wrote where the other side changed the same base lines. They
 * become warnings, `superseded`:
 *
 * - both sides rewrote the same base lines (a version, a list of versions, a block fixed on each
 *   branch), git stopped on a conflict and the merge chose, losing no more lines of the side's
 *   hunk than the base lines or the other side's rewrite count;
 * - one side inserted lines inside a block the other side rewrote or deleted;
 * - the other side deleted the whole file.
 *
 * A line inserted between base lines the other side left alone never is, even when the other side
 * inserted at the same place: dropping one of two new methods or routes is the loss the check
 * exists for. Nor is a hunk that lost more than what competed with it: an edit with a new method
 * under it, whose method went with the edit.
 */
export function supersededLines(
  findings: readonly MergeFinding[],
  sides: MergeSides,
  changes: SideChanges,
): MergeFinding[] {
  return findings.map((finding) =>
    finding.kind === 'lost-line' && isSuperseded(finding, { findings, sides, changes })
      ? { ...finding, kind: 'superseded' }
      : finding,
  );
}

function isSuperseded({ file, line, side }: MergeFinding, context: Context): boolean {
  if (side !== 'ours' && side !== 'theirs') {
    return false;
  }

  const other = side === 'ours' ? 'theirs' : 'ours';

  if (context.sides.base.has(file) && !context.sides[other].has(file)) {
    return true;
  }

  const own = (context.changes[side].get(file) ?? []).find((hunk) => contains(hunk, line));
  const others = context.changes[other].get(file) ?? [];

  if (own === undefined) {
    return false;
  }

  const lost = context.findings.filter(
    (finding) =>
      finding.kind === 'lost-line' && finding.side === side && finding.file === file && contains(own, finding.line),
  ).length;

  return own.oldCount === 0
    ? others.some((hunk) => isInside(own, hunk))
    : others.some((hunk) => overlaps(own, hunk) && lost <= Math.max(own.oldCount, hunk.newCount));
}

function contains(hunk: Hunk, line: number): boolean {
  return line >= hunk.newStart && line < hunk.newStart + hunk.newCount;
}

/** Whether an insertion stands between two base lines the other hunk both replaced: inside a block the other side rewrote or deleted. */
function isInside(insertion: Hunk, other: Hunk): boolean {
  return other.oldStart <= insertion.oldStart && insertion.oldStart + 1 < other.oldStart + other.oldCount;
}

/** Whether two hunks replaced some of the same base lines. */
function overlaps(one: Hunk, other: Hunk): boolean {
  return (
    one.oldCount > 0 &&
    other.oldCount > 0 &&
    one.oldStart < other.oldStart + other.oldCount &&
    other.oldStart < one.oldStart + one.oldCount
  );
}
