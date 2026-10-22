import { sectionOf } from '../stories/section-of';
import type { BranchCommit } from './branch-commit';
import { fileAt } from './file-at';
import { hours } from './hours';
import type { Repository } from './repository';
import type { StoryHistory } from './story-history';
import type { Timeline } from './timeline';

/**
 * Design: the first commit of the story file to the commit of its lock. Build: the lock to the
 * first commit whose `## Report` holds text. Lead: the first commit to the commit of the branch
 * that carries the branch of the story (`story/<code>` in its subject, a merge commit first).
 */
export function timelineOf(repository: Repository, history: StoryHistory, branch: readonly BranchCommit[]): Timeline {
  const { files, commits } = history;
  const [first] = commits.ofStoryFile;

  if (first === undefined) {
    return {};
  }

  const lock = commits.lock;
  const report = commits.ofStoryFile.find((commit) => reported(repository, commit, files.file));
  const merged = mergeCommit(files.story, branch);

  return {
    opened: new Date(first.at).toISOString(),
    author: first.author,
    ...(lock === undefined ? {} : { designHours: hours(lock.at - first.at) }),
    ...(lock === undefined || report === undefined ? {} : { buildHours: hours(report.at - lock.at) }),
    ...(merged === undefined ? {} : { leadHours: hours(merged.at - first.at), merged: merged.sha.slice(0, 7) }),
  };
}

/** True when the version of the story file at the commit has a `## Report` with text. */
function reported(repository: Repository, commit: BranchCommit, file: string): boolean {
  return (sectionOf(fileAt(repository, commit.sha, file) ?? '', 'Report') ?? '').trim() !== '';
}

/** The commit of the branch whose subject names `story/<code>`: a merge commit, else any. */
function mergeCommit(story: string, branch: readonly BranchCommit[]): BranchCommit | undefined {
  const name = `story/${story.toLowerCase()}`;
  const naming = branch.filter((commit) => commit.subject.toLowerCase().includes(name));

  return naming.find((commit) => commit.parents.length > 1) ?? naming[0];
}
