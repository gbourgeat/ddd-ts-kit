import type { StoryCommits } from './story-commits.js';
import type { StoryFiles } from './story-files.js';

/** The files of a story and the commits of the branch that belong to it. */
export interface StoryHistory {
  readonly files: StoryFiles;
  readonly commits: StoryCommits;
}
