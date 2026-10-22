import { gitProcess } from './git-process';

/** How a patch is written to be compared: no context, no rename, no colour, whatever the user's config says. */
const PATCH = ['-p', '-U0', '--no-renames', '--no-color', '--no-ext-diff'];

/**
 * The stable patch id of each patch `git <log|diff> <args>` writes, with the commit it names:
 * zeros for a diff. Line numbers and whitespace do not count, and without context lines a patch
 * stays the same whatever another change did next to it.
 */
export function patchIdsOf(root: string, [command, ...args]: readonly string[]): (readonly [string, string])[] {
  const patches = command === undefined ? '' : gitProcess(root, [command, ...PATCH, ...args]).stdout;

  if (patches.trim() === '') {
    return [];
  }

  return gitProcess(root, ['patch-id', '--stable'], patches)
    .stdout.split('\n')
    .map((line) => line.trim().split(/\s+/))
    .filter((parts): parts is [string, string] => parts.length === 2 && parts[0] !== '')
    .map(([id, commit]) => [id, commit] as const);
}
