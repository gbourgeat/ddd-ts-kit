import fs from 'node:fs';
import path from 'node:path';
import { CliError } from '../cli-error';
import { filesGitDoesNotHold } from './files-git-does-not-hold';

/**
 * `--force` never destroys work git does not hold. Of the files it replaces with another content,
 * one that differs from the last commit (uncommitted, or untracked and not ignored) refuses the
 * whole command, the files named; outside a git repository, every one of them does, since nothing
 * else holds what was written there.
 */
export function refuseUnheld(
  root: string,
  files: Iterable<string>,
  pending: ReadonlyMap<string, { readonly content: string }>,
): void {
  const replaced = [...files].sort().flatMap((file) => {
    const planned = pending.get(file);

    return planned === undefined ? [] : [{ file, content: planned.content }];
  });

  const changed = replaced
    .filter(({ file, content }) => onDisk(path.join(root, file)) !== content)
    .map(({ file }) => file);

  if (changed.length === 0) {
    return;
  }

  // A link of the project is written through: git is asked about the file it points to, as well as the link.
  const written = new Map(changed.map((file) => [file, writtenAt(root, file)]));
  const notHeld = filesGitDoesNotHold(root, [...new Set([...changed, ...written.values()])]);

  const named =
    notHeld === undefined
      ? undefined
      : changed.filter((file) => notHeld.includes(file) || notHeld.includes(written.get(file) ?? file));

  if (named === undefined) {
    throw new CliError(
      `--force would replace ${changed.length} file(s) whose content differs from what the kit writes, outside a git repository, where nothing else holds them: ${changed.join(', ')}. Nothing was written.`,
      'Keep a copy of what you wrote in them and delete them first, then run again; in a git repository, commit them first, and git diff shows what the kit rewrote.',
    );
  }

  if (named.length > 0) {
    throw new CliError(
      `--force would replace ${named.length} file(s) that differ from the last commit, uncommitted or untracked: ${named.join(', ')}. Nothing was written.`,
      'Commit or stash them first, then run again: git diff shows what the kit rewrote.',
    );
  }
}

/** The path of the project a write of `file` lands at: the file a link of the project points to, or the file itself. */
function writtenAt(root: string, file: string): string {
  try {
    return path
      .relative(fs.realpathSync(root), fs.realpathSync(path.join(root, file)))
      .split(path.sep)
      .join('/');
  } catch {
    return file;
  }
}

/** The text of a file on disk; undefined when none is there, or when what stands there is no file. */
function onDisk(absolute: string): string | undefined {
  try {
    return fs.readFileSync(absolute, 'utf8');
  } catch {
    return undefined;
  }
}
