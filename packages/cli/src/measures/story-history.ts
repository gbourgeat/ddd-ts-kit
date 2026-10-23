import type { StoryCommits } from './story-commits';
import type { StoryFiles } from './story-files';

/** The files of a story and the commits of the branch that belong to it. */
export interface StoryHistory {
  readonly files: StoryFiles;
  readonly commits: StoryCommits;
}
