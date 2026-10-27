import { gitProcess } from './git-process';
import { isMergePath } from './is-merge-path';
import type { MergeRepository } from './lost/merge-repository';
import { modifiedSinceStaged } from './modified-since-staged';

/**
 * Stages again what the steps of the merge rewrote after the merge staged it (`npm run regenerate`
 * rewrites a derived file the trunk changed): a staged file modified again makes `git merge --abort`
 * refuse with "not uptodate". Only the paths of the merge are staged, what a person edited is not.
 */
export function stageRewritten(repo: MergeRepository): void {
  const rewritten = modifiedSinceStaged(repo).filter((file) => isMergePath(file, repo));

  if (rewritten.length > 0) {
    gitProcess(
      repo.top,
      ['--literal-pathspecs', 'add', '--all', '--pathspec-from-file=-', '--pathspec-file-nul'],
      `${rewritten.join('\0')}\0`,
    );
  }
}
