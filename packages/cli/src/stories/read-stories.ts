import fs from 'node:fs';
import path from 'node:path';
import { runGit } from '../commit/run-git';
import { classifyConflict } from '../merge/classify-conflict';
import type { MergeRepository } from '../merge/lost/merge-repository';
import { mergeRepositoryOf } from '../merge/lost/merge-repository-of';
import { changedFiles } from '../worker/changed-files';
import { forecastMerge } from './forecast-merge';
import type { MergeForecast } from './merge-forecast';
import type { OpenStory } from './open-story';
import { openStories } from './open-stories';
import { readStoryPlace } from './read-story-place';
import type { StoriesView } from './stories-view';
import type { StoryCrossing } from './story-crossing';
import type { StoryState } from './story-state';

/**
 * The stories open in the worktrees of the repository of the project at `root`, each with the
 * files it changed and the trunk merged in now, and each pair of them that meets. From the
 * worktree of a story, the pairs it is in, that story first. Reads git and the files, changes
 * nothing but objects of the repository.
 */
export function readStories(root: string): StoriesView {
  const repo = mergeRepositoryOf(root);
  const here = readStoryPlace(root)?.story;
  const stories = openStories(root, repo.prefix).map((story) => stateOf(repo, story));
  const own = stories.find((story) => story.story === here);

  const pairs =
    own === undefined
      ? stories.flatMap((first, index) => stories.slice(index + 1).map((second) => [first, second] as const))
      : stories.filter((other) => other !== own).map((other) => [own, other] as const);

  return {
    ...(here === undefined ? {} : { here }),
    stories,
    crossings: pairs.flatMap(([first, second]) => crossingOf(repo, first, second)),
    ...fetchedOf(repo.top),
  };
}

/** When the last fetch wrote FETCH_HEAD, shared by every worktree of the repository. */
function fetchedOf(top: string): { fetched?: string } {
  const common = runGit(top, ['rev-parse', '--git-common-dir'])?.trim();

  const stat =
    common === undefined ? undefined : fs.statSync(path.resolve(top, common, 'FETCH_HEAD'), { throwIfNoEntry: false });

  return stat === undefined ? {} : { fetched: stat.mtime.toISOString() };
}

function stateOf(repo: MergeRepository, story: OpenStory): StoryState {
  const top = runGit(story.worktree, ['rev-parse', '--show-toplevel'])?.trim() ?? story.worktree;
  const { base, branch } = story;
  const mergeBase = runGit(top, ['merge-base', base, 'HEAD'])?.trim();
  const trunk = branch === undefined ? undefined : forecastMerge(repo, { ours: branch, theirs: base });

  return { ...story, files: changedFiles(top, mergeBase), ...(trunk === undefined ? {} : { trunk }) };
}

function crossingOf(repo: MergeRepository, first: StoryState, second: StoryState): StoryCrossing[] {
  const contexts = first.contexts.filter((context) => second.contexts.includes(context));
  const files = first.files.filter((file) => second.files.includes(file) && classifyConflict(file, repo) === 'source');
  const merge = mergeOf(repo, first, second);
  const conflicts = (merge?.settled.length ?? 0) + (merge?.byHand.length ?? 0);

  if (contexts.length === 0 && files.length === 0 && conflicts === 0) {
    return [];
  }

  return [{ stories: [first.story, second.story], contexts, files, ...(merge === undefined ? {} : { merge }) }];
}

/** The branch of the second merged into the branch of the first now; none while either has no branch. */
function mergeOf(repo: MergeRepository, first: StoryState, second: StoryState): MergeForecast | undefined {
  return first.branch === undefined || second.branch === undefined
    ? undefined
    : forecastMerge(repo, { ours: first.branch, theirs: second.branch });
}
