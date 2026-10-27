import { spawnSync } from 'node:child_process';
import path from 'node:path';

/** Answers whether an entry below the directory walked, relative to the root, is one git ignores. */
export type Ignored = (entry: string, isDirectory: boolean) => boolean;

/**
 * What git ignores below `directory`: an entry a `.gitignore`, `.git/info/exclude` or the global
 * excludes file of the machine names, which no one tracks. One `git ls-files` call lists them, a
 * directory whose content is all ignored as that directory alone, so that the walk does not enter
 * it. Outside a git repository, without git, or when the project itself sits in a directory its
 * enclosing repository ignores, nothing is ignored and the walk reads every entry.
 */
export function gitIgnored(root: string, directory: string): Ignored {
  const run = spawnSync(
    'git',
    ['ls-files', '-z', '--others', '--ignored', '--exclude-standard', '--directory', '--', directory],
    { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], maxBuffer: 1 << 28 },
  );

  if (run.status !== 0 || typeof run.stdout !== 'string') {
    return nothingIgnored;
  }

  const entries = run.stdout.split('\0').filter((entry) => entry !== '');

  // The root itself is ignored: the rules of that repository are not the project's.
  if (entries.includes('./')) {
    return nothingIgnored;
  }

  const ignored = new Set(entries.map((entry) => path.posix.normalize(entry)));

  return (entry, isDirectory) => ignored.has(path.posix.normalize(isDirectory ? `${entry}/` : entry));
}

function nothingIgnored(): boolean {
  return false;
}
