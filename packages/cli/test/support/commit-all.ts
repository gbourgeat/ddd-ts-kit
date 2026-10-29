import fs from 'node:fs';
import path from 'node:path';
import { git } from './git';

/**
 * What a team does before `--force`, which never replaces what git does not hold: the project in
 * a git repository, everything in it committed.
 */
export function commitAll(root: string): void {
  if (!fs.existsSync(path.join(root, '.git'))) {
    git(root, 'init', '--quiet', '--initial-branch', 'main');
  }

  git(root, 'add', '--all');
  git(root, 'commit', '--quiet', '--allow-empty', '--message', 'chore: before --force');
}
