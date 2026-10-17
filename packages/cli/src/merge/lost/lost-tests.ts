import type { MergeFinding } from './merge-finding.js';
import type { MergeSides } from './merge-sides.js';
import { rankedPlaces } from './ranked-places.js';
import { SPEC_FILE } from './spec-file.js';
import { threeWayCount } from './three-way-count.js';

/** The title of an `it(` or a `test(`, with its modifiers, on one line or after a line break. */
const TEST_TITLE =
  /\b(?:it|test)(?:\.(?:todo|only|skip|concurrent|fails|skipIf\([^)]*\)|runIf\([^)]*\)))?\(\s*(['"`])((?:\\.|(?!\1).)*)\1/g;

type Place = { readonly file: string; readonly line: number };

/**
 * The tests of a side the result no longer has: each title of a spec file, counted over every
 * spec file of the merge, is expected as many times as the base had it plus what the sides added
 * minus what they removed. A test one side deleted is not lost; a test moved to another spec
 * file is not either.
 */
export function lostTests(sides: MergeSides): MergeFinding[] {
  const base = titlesOf(sides.base);
  const ours = titlesOf(sides.ours);
  const theirs = titlesOf(sides.theirs);
  const result = titlesOf(sides.result);

  return [...new Set([...ours.keys(), ...theirs.keys()])].flatMap((title) => {
    const count = threeWayCount(
      placesOf(base, title).length,
      placesOf(ours, title).length,
      placesOf(theirs, title).length,
    );

    const missing = count.expected - placesOf(result, title).length;
    const side = count.addedBy === 'theirs' ? theirs : ours;

    return rankedPlaces(placesOf(side, title), placesOf(base, title), placesOf(result, title))
      .slice(0, Math.max(missing, 0))
      .map(({ file, line }): MergeFinding => ({ kind: 'test-lost', file, line, side: count.addedBy, text: title }));
  });
}

function titlesOf(files: ReadonlyMap<string, string>): Map<string, Place[]> {
  const titles = new Map<string, Place[]>();

  for (const [file, content] of files) {
    if (!SPEC_FILE.test(file)) {
      continue;
    }

    for (const match of content.matchAll(TEST_TITLE)) {
      const places = titles.get(match[2] ?? '') ?? [];

      places.push({ file, line: content.slice(0, match.index).split('\n').length });
      titles.set(match[2] ?? '', places);
    }
  }

  return titles;
}

function placesOf(titles: ReadonlyMap<string, readonly Place[]>, title: string): readonly Place[] {
  return titles.get(title) ?? [];
}
