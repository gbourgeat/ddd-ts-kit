import type { BranchCommit } from './branch-commit.js';
import type { StoryCommits } from './story-commits.js';
import type { StoryFiles } from './story-files.js';

/** The commits of the branch that belong to the story. */
export function storyCommitsOf(files: StoryFiles, commits: readonly BranchCommit[]): StoryCommits {
  const prefix = `${files.story.toLowerCase()}.`;
  const own = new Set([files.file, files.review, files.lock, files.acceptance].filter((path) => path !== undefined));

  const ofSlice = (commit: BranchCommit): boolean =>
    commit.slices.some((slice) => slice.toLowerCase().startsWith(prefix));

  const all = commits.filter((commit) => ofSlice(commit) || commit.files.some((path) => own.has(path)));
  const lock = all.find((commit) => commit.files.includes(files.lock));
  const firstSlice = all.find(ofSlice);

  return {
    all,
    ofStoryFile: all.filter((commit) => commit.files.includes(files.file)),
    ...(lock === undefined ? {} : { lock }),
    ...(firstSlice === undefined ? {} : { firstSlice }),
  };
}
