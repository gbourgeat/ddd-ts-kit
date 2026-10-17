/** A path a merge left conflicted: the text of each side it has, and what the merge wrote. */
export interface ConflictedPath {
  /** From the top of the repository. */
  readonly file: string;
  /** Each side as text; absent when that side has no such file. */
  readonly base?: string;
  readonly ours?: string;
  readonly theirs?: string;
  /** What the merge wrote, conflicts as diff3 markers; absent when it wrote nothing. */
  readonly merged?: string;
  /** A side holds bytes that are not text: nothing is merged from it. */
  readonly binary: boolean;
}
