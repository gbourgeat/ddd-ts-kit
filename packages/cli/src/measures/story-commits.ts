import type { BranchCommit } from './branch-commit';

/** The commits of one story on the branch, oldest first, and the ones of its files. */
export interface StoryCommits {
  /** Commits carrying a `Slice: <code>.<n>` trailer, or touching a file of the story. */
  readonly all: readonly BranchCommit[];
  /** The commits that touched the story file. */
  readonly ofStoryFile: readonly BranchCommit[];
  /** The first commit that touched the lock. */
  readonly lock?: BranchCommit;
  /** The first commit carrying a `Slice: <code>.` trailer: the build started there. */
  readonly firstSlice?: BranchCommit;
}
