/** The advised size of one commit: `check --commit-size` and the editor hook of the plugin read it. */
export interface CommitLimits {
  readonly maxFiles: number;
  readonly maxLines: number;
}
