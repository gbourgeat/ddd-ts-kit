/** One commit of the current branch, as `git log` prints it. */
export interface BranchCommit {
  readonly sha: string;
  readonly parents: readonly string[];
  /** The committer date, in milliseconds since the epoch. */
  readonly at: number;
  readonly author: string;
  readonly subject: string;
  /** The values of its `Slice:` trailers. */
  readonly slices: readonly string[];
  /** The paths it changed, relative to the repository root. */
  readonly files: readonly string[];
}
