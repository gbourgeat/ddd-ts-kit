import { reviewFileOf } from '../stories/review-file-of.js';
import type { Workspace } from '../workspace/index.js';
import type { BranchCommit } from './branch-commit.js';
import { repeatedIncident } from './repeated-incident.js';
import { reportMeasuresOf } from './report-measures-of.js';
import type { Repository } from './repository.js';
import { reviewReadingOf } from './review-reading-of.js';
import { reworkOf } from './rework-of.js';
import { storyCommitsOf } from './story-commits-of.js';
import { storyFilesOf } from './story-files-of.js';
import type { StoryReading } from './story-reading.js';
import { timelineOf } from './timeline-of.js';

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
