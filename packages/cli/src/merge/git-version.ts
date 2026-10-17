import { runGit } from '../commit/run-git.js';

/** The first version of git whose `merge-tree --write-tree` takes `--merge-base`. */
const MERGE_BASE_SINCE = [2, 40] as const;

/**
 * The version of git, as `git version` prints it (or `probed`, which a test passes), and whether
 * its merge-tree computes a merge from a given base.
 */
export function gitVersion(top: string, probed?: string): { version: string; mergeBase: boolean } {
  const printed = probed ?? runGit(top, ['version']) ?? '';
  const [major = 0, minor = 0] = (/(\d+)\.(\d+)/.exec(printed) ?? []).slice(1).map(Number);
  const [wantedMajor, wantedMinor] = MERGE_BASE_SINCE;

  return {
    version: /(\d+(?:\.\d+)+)/.exec(printed)?.[1] ?? 'unknown',
    mergeBase: major > wantedMajor || (major === wantedMajor && minor >= wantedMinor),
  };
}
