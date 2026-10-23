import { CliError } from '../cli-error';
import { runGit } from '../commit/run-git';
import { conflictedPaths } from '../merge/conflicted-paths';
import type { MergeRepository } from '../merge/lost/merge-repository';
import { previewMerge } from '../merge/preview-merge';
import type { Resolution } from '../merge/resolution';
import { resolveConflict } from '../merge/resolve-conflict';
import type { ForecastPath, MergeForecast } from './merge-forecast';

/** The two branches of a forecast: `theirs` merged into `ours`. */
export interface ForecastSides {
  readonly ours: string;
  readonly theirs: string;
}

/**
 * Merging `theirs` into `ours` now, as `merge-trunk` would settle it: `git merge-tree` from the
 * base git computes, each conflicted path settled or left to a person. Nothing is written but
 * objects of the repository. Undefined when a side names no commit or git is older than 2.40.
 */
export function forecastMerge(repo: MergeRepository, { ours, theirs }: ForecastSides): MergeForecast | undefined {
  const behind = runGit(repo.top, ['rev-list', '--count', `${ours}..${theirs}`])?.trim();

  if (behind === undefined) {
    return undefined;
  }

  if (behind === '0') {
    return { ref: theirs, behind: 0, settled: [], byHand: [] };
  }

  const resolutions = resolutionsOf(repo, { ours, theirs });

  return resolutions === undefined
    ? undefined
    : {
        ref: theirs,
        behind: Number(behind),
        settled: resolutions.filter((resolution) => resolution.settled).map(pathOf),
        byHand: resolutions.filter((resolution) => !resolution.settled).map(pathOf),
      };
}

function resolutionsOf(repo: MergeRepository, sides: ForecastSides): Resolution[] | undefined {
  try {
    const { tree, conflicts } = previewMerge(repo.top, sides);

    return conflictedPaths(repo.top, conflicts, { tree }).map((path) => resolveConflict(path, repo));
  } catch (error) {
    if (error instanceof CliError) {
      return undefined;
    }

    throw error;
  }
}

function pathOf({ file, kind }: Resolution): ForecastPath {
  return { file, kind };
}
