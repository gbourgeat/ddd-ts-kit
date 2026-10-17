/** One merge to verify: its three inputs, and its result. */
export interface MergeToVerify {
  /** The merge commit, or the squash commit; undefined for the merge in progress (its result is the index plus the working tree). */
  readonly commit?: string;
  readonly subject: string;
  readonly base: string;
  /** Where the base comes from: the `Merge-Base:` trailer, `--base`, or `git merge-base`. */
  readonly baseFrom: 'trailer' | 'option' | 'merge-base';
  /** The first parent: the branch the merge was made on. */
  readonly ours: string;
  /** The second parent, or `--theirs`: what was brought in. */
  readonly theirs: string;
  /** The `file:line` (or `file`) entries of its `Lost-Accepted:` trailer: removals someone decided. */
  readonly accepted: readonly string[];
}
