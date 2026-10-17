/**
 * The text files of a merge at its four points, by path from the top of the repository: the
 * base, each side, and the result. A path missing from a point is absent there, or binary.
 */
export interface MergeSides {
  readonly base: ReadonlyMap<string, string>;
  readonly ours: ReadonlyMap<string, string>;
  readonly theirs: ReadonlyMap<string, string>;
  readonly result: ReadonlyMap<string, string>;
}
