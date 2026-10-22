import type { MergeFinding } from './merge-finding';
import type { MergeSides } from './merge-sides';
import { normalizedLines } from './normalized-lines';
import type { Hunk } from './hunk';
import type { SideChanges } from './superseded-lines';

/**
 * The lost lines the merge replaced, where they stood, by lines of its own that no side has: a
 * line edited in the merge commit (a version in a heading, a call adapted to the other side's
 * rename). They become warnings, `rewritten`. Taking the other side's lines in their place, as
 * `-X theirs` does, never is: those lines are not the merge's own. Nor is a hunk that dropped more
 * than twice the lines it wrote plus two.
 */
export function rewrittenInPlace(
  findings: readonly MergeFinding[],
  sides: MergeSides,
  toResult: SideChanges,
): MergeFinding[] {
  const known = new Set(
    [sides.base, sides.ours, sides.theirs].flatMap((files) =>
      [...files.values()].flatMap((content) => normalizedLines(content).map(({ text }) => text)),
    ),
  );

  return findings.map((finding) =>
    finding.kind === 'lost-line' && isReplacedByOwnLines(finding, { sides, toResult, known })
      ? { ...finding, kind: 'rewritten' }
      : finding,
  );
}

interface Context {
  readonly sides: MergeSides;
  readonly toResult: SideChanges;
  readonly known: ReadonlySet<string>;
}

function isReplacedByOwnLines({ file, line, side }: MergeFinding, { sides, toResult, known }: Context): boolean {
  const hunk = (toResult[side === 'theirs' ? 'theirs' : 'ours'].get(file) ?? []).find(
    (candidate) => line >= candidate.oldStart && line < candidate.oldStart + candidate.oldCount,
  );

  if (hunk === undefined || !isInPlace(hunk)) {
    return false;
  }

  const written = (sides.result.get(file) ?? '')
    .split('\n')
    .slice(hunk.newStart - 1, hunk.newStart - 1 + hunk.newCount);

  return normalizedLines(written.join('\n')).some(({ text }) => !known.has(text));
}

function isInPlace({ oldCount, newCount }: Hunk): boolean {
  return newCount > 0 && oldCount <= 2 * newCount + 2;
}
