import type { DependencyInstall } from '../worker/install-dependencies';
import type { OpenStory } from './open-story';
import type { StoryKind } from './story-kind';

/** What `story-scope` prepared, or would prepare in a dry run. */
export interface StoryScope {
  readonly story: string;
  /** `story`, or `fix` for a story built behind locked regression specs. */
  readonly kind: StoryKind;
  /** Where the story comes from, relative to the project root: an accepted intent or an incident record. */
  readonly from?: string;
  /** True while the story has an origin and no file yet: the story skill seeds its statement from the origin. */
  readonly seeds: boolean;
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
