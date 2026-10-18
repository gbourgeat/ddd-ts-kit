import { CliError } from '../cli-error.js';
import { runGit } from '../commit/run-git.js';

/** The path of the project inside its repository, empty at its top; refused outside a repository or before its first commit. */
export function repositoryPrefix(root: string): string {
  const prefix = runGit(root, ['rev-parse', '--show-prefix']);

  if (prefix === undefined) {
    throw new CliError(
      `${root} is not inside a git repository.`,
      'Run `git init` and make a first commit: a worktree is cut from a commit.',
    );
  }

  if (runGit(root, ['rev-parse', '--verify', '--quiet', 'HEAD']) === undefined) {
    throw new CliError(
      'The repository has no commit yet.',
      'Commit the bootstrap first: a worktree is cut from a commit.',
    );
  }

  return prefix.trim();
}
