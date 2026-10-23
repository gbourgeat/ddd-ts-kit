import { criteriaIn } from '../acceptance/criteria-in.js';
import { readLock } from '../acceptance/read-lock.js';
import { readVerdicts } from '../acceptance/read-verdicts.js';
import type { Workspace } from '../workspace/index.js';
import { fileAt } from './file-at.js';
import type { Repository } from './repository.js';
import type { Rework } from './rework.js';
import type { StoryHistory } from './story-history.js';

/**
 * The commits that changed the acceptance criteria of the story after its build started (the
 * first commit carrying a `Slice: <code>.` trailer), the amendments its lock recorded and the
 * `refuse` verdicts written for it.
 */
export function reworkOf(repository: Repository, ws: Workspace, history: StoryHistory): Rework {
  const { story } = history.files;

  return {
    criteriaChanges: criteriaChanges(repository, history),
    amendments: readLock(ws, story)?.amendments.length ?? 0,
    refusals: readVerdicts(ws, story).filter((verdict) => verdict.verdict === 'refuse').length,
  };
}

/** How many commits after the first slice commit left the criteria different from the version before them. */
function criteriaChanges(repository: Repository, { files, commits }: StoryHistory): number {
  const started = commits.firstSlice;

  if (started === undefined) {
    return 0;
  }

  const versions = commits.ofStoryFile.map((commit) => ({
    at: commit.at,
    criteria: criteriaIn(fileAt(repository, commit.sha, files.file) ?? '')
      .map((criterion) => `${criterion.id}:${criterion.fingerprint}`)
      .join('\n'),
  }));

  return versions.filter(
    (version, index) => index > 0 && version.at > started.at && version.criteria !== versions[index - 1]?.criteria,
  ).length;
}
