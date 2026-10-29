import fs from 'node:fs';
import path from 'node:path';
import { runGit } from '../commit/run-git';

/**
 * The files among `files` (paths of the project at `root`) whose content git does not hold:
 * changed since the last commit, staged or not, or untracked and not ignored. Undefined outside
 * a git repository, or when git is not installed: nothing then holds any of them.
 */
export function filesGitDoesNotHold(root: string, files: readonly string[]): string[] | undefined {
  const top = runGit(root, ['rev-parse', '--show-toplevel'])?.trim();

  if (top === undefined || top === '') {
    return undefined;
  }

  // Each path as it is written: `[`, `*`, `?` and a leading `:` are no pattern nor magic of git here.
  const status =
    runGit(root, ['--literal-pathspecs', 'status', '--porcelain=v1', '-z', '--untracked-files=all', '--', ...files]) ??
    '';

  const project = fs.realpathSync(root);

  // Each entry is `XY <path>`, relative to the top of the repository; a rename adds the old path as its own entry.
  const changed = new Set(
    status
      .split('\0')
      .filter((entry) => /^[ MADRCU?!]{2} /.test(entry))
      .map((entry) =>
        path
          .relative(project, path.join(top, entry.slice(3)))
          .split(path.sep)
          .join('/'),
      ),
  );

  return files.filter((file) => changed.has(file));
}
