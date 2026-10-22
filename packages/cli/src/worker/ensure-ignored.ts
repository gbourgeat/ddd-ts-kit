import path from 'node:path';
import { CliError } from '../cli-error';
import { runGit } from '../commit/run-git';
import { WORKTREES_DIR } from './worktree-home';

/**
 * Refuses a worktree of `.worktrees/` that git does not ignore in the project holding it: its
 * folder would be committed there as an embedded repository, and every tool of the project would
 * read it. `worktree` is a path `worktreeHome` gave.
 */
export function ensureIgnored(worktree: string): void {
  const project = path.dirname(path.dirname(worktree));
  const relative = path.relative(project, worktree);

  if (runGit(project, ['check-ignore', '--quiet', relative]) === undefined) {
    throw new CliError(
      `${relative} is not ignored by git: the worktree would be committed as an embedded repository, and the tools of the project would read it.`,
      `Add \`${WORKTREES_DIR}/\` to .gitignore on the trunk (\`npx ddd-ts-kit init\` adds it), commit it, then run it again; or pass \`--worktree <path>\` outside the project.`,
    );
  }
}
