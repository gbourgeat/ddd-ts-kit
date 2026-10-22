import type { MergeForecast } from './merge-forecast';
import type { OpenStory } from './open-story';

/** One open story as `stories` reads it in its worktree. */
export interface StoryState extends OpenStory {
  /**
   * The files its worktree changed, relative to the top of the repository: committed since the
   * merge base with its base, modified, and untracked but not ignored.
   */
  readonly files: readonly string[];
  /** Its base merged into its branch now; absent when either names no commit. */
  readonly trunk?: MergeForecast;
}
