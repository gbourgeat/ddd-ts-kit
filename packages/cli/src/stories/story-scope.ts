import type { DependencyInstall } from '../worker/install-dependencies.js';
import type { OpenStory } from './open-story.js';

/** What `story-scope` prepared, or would prepare in a dry run. */
export interface StoryScope {
  readonly story: string;
  readonly dryRun: boolean;
  readonly worktree: string;
  readonly branch: string;
  readonly base: string;
  /** False when the worktree of the story was already there: the story resumes. */
  readonly created: boolean;
  readonly install?: DependencyInstall;
  /** The other stories open in the repository, with the contexts they change. */
  readonly others: readonly OpenStory[];
  readonly notes: readonly string[];
}
