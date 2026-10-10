import fs from 'node:fs';
import path from 'node:path';
import type { Change } from './change.js';
import { runGit } from './run-git.js';

const NUMSTAT = ['--numstat', '--no-renames', '--relative', '-z'];
const COUNTED_FILE_BYTES = 1_000_000;

/**
 * What a commit made now would hold: the index with `staged`, else every tracked change since
 * HEAD and every untracked file. Undefined outside a git repository. Counted as the editor hook
 * of the plugin counts.
 */
export function readChanges(root: string, staged: boolean): Change[] | undefined {
  if (runGit(root, ['rev-parse', '--is-inside-work-tree'])?.trim() !== 'true') return undefined;
  if (staged) return entries(runGit(root, ['diff', '--cached', ...NUMSTAT])).map(numstatChange);

  const fresh = entries(runGit(root, ['ls-files', '--others', '--exclude-standard', '-z'])).map((file) => ({ path: file, lines: lineCount(path.join(root, file)) }));

  return [...entries(runGit(root, ['diff', ...NUMSTAT, 'HEAD'])).map(numstatChange), ...fresh];
}

function entries(output: string | undefined): string[] {
  return (output ?? '').split('\0').filter((entry) => entry !== '');
}

/** `<added>\t<deleted>\t<path>`; a binary file is written `-` and counts no line. */
function numstatChange(entry: string): Change {
  const [added, deleted, ...file] = entry.split('\t');

  return { path: file.join('\t'), lines: (Number(added) || 0) + (Number(deleted) || 0) };
}

/** The lines of an untracked file; none for a file too large to be source. */
function lineCount(file: string): number {
  try {
    if (fs.statSync(file).size > COUNTED_FILE_BYTES) return 0;

    const lines = fs.readFileSync(file, 'utf8').split('\n');

    return lines.at(-1) === '' ? lines.length - 1 : lines.length;
  } catch {
    return 0;
  }
}
