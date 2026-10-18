/** A story open in another worktree of the repository. */
export interface OpenStory {
  readonly story: string;
  readonly worktree: string;
  readonly branch?: string;
  /** The ref its branch was cut from and merges back into. */
  readonly base: string;
  /** The contexts its rows name, read in its worktree; empty before its rows are planned. */
  readonly contexts: readonly string[];
}
