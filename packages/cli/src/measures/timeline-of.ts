import { sectionOf } from '../stories/section-of';
import type { BranchCommit } from './branch-commit';
import { fileAt } from './file-at';
import { hours } from './hours';
import type { Repository } from './repository';
import type { StoryHistory } from './story-history';
import type { Timeline } from './timeline';

/**
 * Design: the first commit of the story file to the commit of its lock. Build: the lock to the
 * first commit whose `## Report` holds text. Lead: the first commit to the close, the first commit
 * of the first-parent history of the branch that contains the last commit of the story, whatever
 * its subject (a merge, a squash); a story with no report is not closed.
 */
export function timelineOf(repository: Repository, history: StoryHistory, branch: readonly BranchCommit[]): Timeline {
  const { files, commits } = history;
  const [first] = commits.ofStoryFile;

  if (first === undefined) {
    return {};
  }

  const lock = commits.lock;
  const report = commits.ofStoryFile.find((commit) => reported(repository, commit, files.file));
  const merged = report === undefined ? undefined : closeOf(history.commits.all, branch);

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

/**
 * The first commit of the first-parent history of the branch that has the last commit of the story
 * among its ancestors (or is it). Parents come first in `branch`, so one pass marks every commit
 * that contains it. A merge of the trunk into the story branch never contains it before the story
 * ends, and a squash merge, which carries the files of the story itself, is the last commit.
 */
function closeOf(own: readonly BranchCommit[], branch: readonly BranchCommit[]): BranchCommit | undefined {
  const last = own.at(-1);
  const head = branch.at(-1);

  /* v8 ignore next 3 -- ADR-0001: this runs once a report commit was found, so neither list is empty */
  if (last === undefined || head === undefined) {
    return undefined;
  }

  const containing = containingSet(last, branch);
  const bySha = new Map(branch.map((commit) => [commit.sha, commit]));
  let close: BranchCommit | undefined;

  for (let at = containing.has(head.sha) ? head : undefined; at !== undefined; ) {
    close = at;
    at = bySha.get(at.parents[0] ?? '');

    if (at !== undefined && !containing.has(at.sha)) {
      at = undefined;
    }
  }

  return close;
}

/** The shas of the commits that are `last` or have it among their ancestors; parents come first in `branch`. */
function containingSet(last: BranchCommit, branch: readonly BranchCommit[]): Set<string> {
  const containing = new Set<string>();

  for (const commit of branch) {
    if (commit.sha === last.sha || commit.parents.some((parent) => containing.has(parent))) {
      containing.add(commit.sha);
    }
  }

  return containing;
}
