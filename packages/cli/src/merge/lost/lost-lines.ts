import { LineCounts } from './line-counts.js';
import type { MergeFinding } from './merge-finding.js';
import type { MergeSides } from './merge-sides.js';
import { rankedPlaces } from './ranked-places.js';
import { threeWayCount } from './three-way-count.js';

/** The four counts of a merge, and the result flattened for the reflow filter. */
interface Counted {
  readonly base: LineCounts;
  readonly ours: LineCounts;
  readonly theirs: LineCounts;
  readonly result: LineCounts;
  readonly flatResult: readonly string[];
}

/**
 * The lines a merge lost or brought back, over the files of `sides` taken as one set. A line is
 * lost when the result holds it fewer times than the base plus what the sides added minus what
 * they removed, unless its text, whitespace aside, is still in a file of the result (a line laid
 * out again on several). A line above that count is brought back when a side removed it, written
 * by the merge otherwise. Lines both sides lost in a file the merge wrote lines of its own in are
 * a hunk the merge rewrote: a warning, not an error.
 */
export function lostLines(sides: MergeSides): MergeFinding[] {
  const counted: Counted = {
    base: LineCounts.of(sides.base),
    ours: LineCounts.of(sides.ours),
    theirs: LineCounts.of(sides.theirs),
    result: LineCounts.of(sides.result),
    flatResult: [...sides.result.values()].map(flat),
  };

  const texts = new Set([...counted.base.texts(), ...counted.ours.texts(), ...counted.theirs.texts()]);
  const findings = [...texts].flatMap((text) => findingsOf(text, counted));
  const written = new Set([...counted.result.texts()].flatMap((text) => writtenIn(text, counted)));

  return findings.map(
    (finding): MergeFinding => (isRewritten(finding, findings, written) ? { ...finding, kind: 'rewritten' } : finding),
  );
}

function findingsOf(text: string, counted: Counted): MergeFinding[] {
  const count = threeWayCount(counted.base.count(text), counted.ours.count(text), counted.theirs.count(text));
  const inResult = counted.result.count(text);

  if (inResult < count.expected && !isReflowed(text, counted.flatResult)) {
    const side = count.addedBy === 'theirs' ? counted.theirs : counted.ours;

    return rankedPlaces(side.places(text), counted.base.places(text), counted.result.places(text))
      .slice(0, count.expected - inResult)
      .map(({ file, line }): MergeFinding => ({ kind: 'lost-line', file, line, side: count.addedBy, text }));
  }

  if (inResult > count.expected && count.removed > 0) {
    return counted.result
      .places(text)
      .slice(0, inResult - count.expected)
      .map(({ file, line }): MergeFinding => ({ kind: 'revived', file, line, side: count.removedBy, text }));
  }

  return [];
}

/** The files where the merge wrote a line neither side had as many times. */
function writtenIn(text: string, counted: Counted): string[] {
  const count = threeWayCount(counted.base.count(text), counted.ours.count(text), counted.theirs.count(text));

  return counted.result.count(text) > count.expected && count.removed === 0
    ? counted.result.places(text).map(({ file }) => file)
    : [];
}

function isRewritten(finding: MergeFinding, findings: readonly MergeFinding[], written: ReadonlySet<string>): boolean {
  if (finding.kind !== 'lost-line' || !written.has(finding.file)) {
    return false;
  }

  const lostIn = (side: MergeFinding['side']): boolean =>
    findings.some((other) => other.kind === 'lost-line' && other.file === finding.file && other.side === side);

  return lostIn('ours') && lostIn('theirs');
}

function isReflowed(text: string, flatResult: readonly string[]): boolean {
  const flattened = flat(text);

  return flatResult.some((content) => content.includes(flattened));
}

/** Text without whitespace, and without the comma a formatter adds before a closing bracket. */
function flat(text: string): string {
  return text.replace(/\s+/g, '').replace(/,([)\]}])/g, '$1');
}
