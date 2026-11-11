import { threeWayCount } from './three-way-count';

type Place = { readonly file: string };

/**
 * The count a merge should hold of one line that is in several files: the smaller of what the
 * files expect as one set and of what each expects on its own, added up. As one set, a line moved
 * to another file is neither lost nor added; file by file, a line each side removed from a
 * different file (the same generated marker, filled here by one side and there by the other) is
 * removed twice, where the set would count the two removals as one.
 */
export function expectedOver(base: readonly Place[], ours: readonly Place[], theirs: readonly Place[]): number {
  const inFile = (places: readonly Place[], file: string): number =>
    places.filter((place) => place.file === file).length;

  const fileByFile = [...new Set([...base, ...ours, ...theirs].map(({ file }) => file))]
    .map((file) => threeWayCount(inFile(base, file), inFile(ours, file), inFile(theirs, file)).expected)
    .reduce((sum, expected) => sum + expected, 0);

  return Math.min(threeWayCount(base.length, ours.length, theirs.length).expected, fileByFile);
}
