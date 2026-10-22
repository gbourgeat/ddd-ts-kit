import { reviewFileOf } from '../stories/review-file-of';
import type { Workspace } from '../workspace';
import type { BranchCommit } from './branch-commit';
import { repeatedIncident } from './repeated-incident';
import { reportMeasuresOf } from './report-measures-of';
import type { Repository } from './repository';
import { reviewReadingOf } from './review-reading-of';
import { reworkOf } from './rework-of';
import { storyCommitsOf } from './story-commits-of';
import { storyFilesOf } from './story-files-of';
import type { StoryReading } from './story-reading';
import { timelineOf } from './timeline-of';

export const STORIES_DIR = 'docs/architecture/stories';

/** What the measures of every story read. */
export interface MeasureSources {
  readonly repository: Repository;
  readonly ws: Workspace;
  readonly branch: readonly BranchCommit[];
}

/** One story read from its files and the commits of the branch. */
export function storyReadingOf(sources: MeasureSources, story: string): StoryReading {
  const { repository, ws, branch } = sources;
  const files = storyFilesOf(story, `${STORIES_DIR}/${story}.md`, reviewFileOf(ws, story));
  const history = { files, commits: storyCommitsOf(files, branch) };
  const report = reportMeasuresOf(ws.read(files.file) ?? '');
  const repeated = report.incident === undefined ? undefined : repeatedIncident(ws, report.incident, branch);
  const review = files.review === undefined ? undefined : ws.read(files.review);

  return {
    history,
    timeline: timelineOf(repository, history, branch),
    rework: reworkOf(repository, ws, history),
    report,
    review: reviewReadingOf(repository, history.commits.all, review),
    ...(repeated === undefined ? {} : { repeatIncident: repeated }),
  };
}
