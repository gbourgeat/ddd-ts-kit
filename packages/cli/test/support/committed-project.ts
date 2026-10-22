import path from 'node:path';
import { cli, tempDir } from '../helpers';
import { git } from './git';

/** A new project in a directory named `name`, alone in a temporary directory, initialised and committed on the branch `main`. */
export function committedProject(name: string, ...flags: readonly string[]): string {
  const root = path.join(tempDir('repository'), name);
  const result = cli(root, 'init', ...flags);

  if (result.code !== 0) {
    throw new Error(`init failed (${result.code}): ${result.stderr || result.stdout}`);
  }

  git(root, 'init', '--quiet', '--initial-branch', 'main');
  git(root, 'add', '--all');
  git(root, 'commit', '--quiet', '--message', 'chore: bootstrap');

  return root;
}
