import path from 'node:path';
import { runGit } from '../commit/run-git.js';

/** The absolute path of a file of the repository's git directory, `MERGE_HEAD` or `MERGE_MSG`: in a linked worktree, its own. */
export function gitPath(top: string, name: string): string {
  return path.resolve(top, runGit(top, ['rev-parse', '--git-path', name])?.trim() ?? path.join('.git', name));
}
