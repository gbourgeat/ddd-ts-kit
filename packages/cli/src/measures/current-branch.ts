import type { Repository } from './repository.js';

/** The current branch, `main`, or `HEAD` when detached; `none` outside a repository. */
export function currentBranch({ root, git }: Repository): string {
  return git(root, ['rev-parse', '--abbrev-ref', 'HEAD'])?.trim() || 'none';
}
