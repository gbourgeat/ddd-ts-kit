import fs from 'node:fs';
import path from 'node:path';
import { CliError } from '../cli-error';
import { UNWRITTEN_EXIT_CODE } from '../workspace/exit-code-of';
import { runGit } from '../commit/run-git';

/**
 * Stops, with nothing changed, when the trunk changes a path this process cannot write: a merge
 * writes the worktree before it records anything, and a sandbox that mounts a path read-only
 * (`.claude/settings.json`, a folder under an Edit deny rule) leaves it half merged. The probe is
 * the one the system answers (`access` for write), the folder of a path the merge creates or removes
 * included, so that a read-only mount is seen without a list of what a sandbox protects.
 */
export function ensureWritable(top: string, trunk: string): void {
  const changed = (runGit(top, ['diff', '--name-only', '-z', mergeBaseOf(top, trunk), trunk]) ?? '')
    .split('\0')
    .filter((file) => file !== '');

  const blocked = changed.filter((file) => !writable(top, file));

  if (blocked.length > 0) {
    throw new CliError(
      `The trunk changes ${blocked.length} path${blocked.length === 1 ? '' : 's'} this session cannot write (read-only here, a sandbox protects them): ${blocked.slice(0, 5).join(', ')}${blocked.length > 5 ? ` and ${blocked.length - 5} more` : ''}. Nothing was changed.`,
      'The owner of the project runs the same command (`npx ddd-ts-kit merge-trunk`, with the same options) from a terminal outside the sandbox: a merge of a trunk that changes the settings of the project or a protected path is theirs.',
      UNWRITTEN_EXIT_CODE,
    );
  }
}

function mergeBaseOf(top: string, trunk: string): string {
  return runGit(top, ['merge-base', 'HEAD', trunk])?.trim() ?? 'HEAD';
}

/** An existing path is writable, and so is the folder the merge creates or removes it in; a new path needs its nearest folder. */
function writable(top: string, file: string): boolean {
  const absolute = path.join(top, file);
  const exists = fs.existsSync(absolute) || isLink(absolute);

  return (exists ? can(absolute) : true) && can(nearestFolder(path.dirname(absolute), top));
}

function isLink(absolute: string): boolean {
  try {
    return fs.lstatSync(absolute).isSymbolicLink();
  } catch {
    return false;
  }
}

function nearestFolder(folder: string, top: string): string {
  return fs.existsSync(folder) || folder === top ? folder : nearestFolder(path.dirname(folder), top);
}

function can(absolute: string): boolean {
  try {
    fs.accessSync(absolute, fs.constants.W_OK);

    return true;
  } catch {
    return false;
  }
}
