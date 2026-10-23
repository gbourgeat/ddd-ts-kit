import type { StoryCrossing } from './story-crossing';
import type { StoryState } from './story-state';

/** What `stories` says: the stories open in the worktrees of the repository, and where they meet. */
export interface StoriesView {
  /** The story of this worktree; absent from any other checkout. */
  readonly here?: string;
  readonly stories: readonly StoryState[];
  /** Each pair of open stories that meets; from the worktree of a story, the pairs it is in. */
  readonly crossings: readonly StoryCrossing[];
  /** When the repository last fetched, as an ISO 8601 date; absent when it never did: the trunk is read as the last fetch left it. */
  readonly fetched?: string;
}
