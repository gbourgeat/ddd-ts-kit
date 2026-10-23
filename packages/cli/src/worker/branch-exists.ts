import { runGit } from '../commit/run-git';

/** True when the repository has a local branch of that name. */
export function branchExists(root: string, branch: string): boolean {
  return runGit(root, ['rev-parse', '--verify', '--quiet', `refs/heads/${branch}`]) !== undefined;
}
