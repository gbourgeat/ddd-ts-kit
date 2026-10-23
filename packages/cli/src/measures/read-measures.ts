import { runGit } from '../commit/run-git';
import type { GitRunner } from '../story/attributed-marker';
import { Workspace } from '../workspace';
import { branchCommits } from './branch-commits';
import { byAuthorOf } from './by-author-of';
import { currentBranch } from './current-branch';
import type { MeasuresRequest } from './measures-request';
import { measuresSummaryOf } from './measures-summary-of';
import type { MeasuresView } from './measures-view';
import { storyMeasuresOf } from './story-measures-of';
import { STORIES_DIR, storyReadingOf } from './story-reading-of';

/** What this version leaves to the platform, said in every output. */
const NOT_COMPUTED = ['time to first review and first-run CI status come from the platform (its API is not read)'];

/** The measures of the stories of `docs/architecture/stories/`, from the git history of the current branch and the files. */
export function readMeasures(root: string, request: MeasuresRequest, git: GitRunner = runGit): MeasuresView {
  const repository = { root, git };
  const ws = new Workspace(root, false);
  const sources = { repository, ws, branch: branchCommits(repository) };
  const since = request.since === undefined ? undefined : Date.parse(request.since);

  const readings = storyCodes(ws, request.story)
    .map((story) => storyReadingOf(sources, story))
    .filter((reading) => since === undefined || Date.parse(reading.timeline.opened ?? '') >= since);

  const stories = storyMeasuresOf(readings, request.byAuthor);

  return {
    branch: currentBranch(repository),
    ...(request.since === undefined ? {} : { since: request.since }),
    stories,
    summary: measuresSummaryOf(stories),
    ...(request.byAuthor ? { byAuthor: byAuthorOf(stories) } : {}),
    notComputed: [...NOT_COMPUTED],
  };
}

function storyCodes(ws: Workspace, only: string | undefined): string[] {
  return ws
    .list(STORIES_DIR)
    .filter((name) => name.endsWith('.md'))
    .map((name) => name.slice(0, -'.md'.length))
    .filter((code) => only === undefined || code.toLowerCase() === only.toLowerCase());
}
