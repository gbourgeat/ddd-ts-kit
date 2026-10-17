import type { Remaining } from '../progress/remaining.js';
import type { GitRunner } from './attributed-marker.js';

const NOT_COMMITTED = '0'.repeat(40);
const HEADER = /^([0-9a-f]{40}) \d+ (\d+)/gm;

/**
 * The commit that wrote the line of each marker, by `file:line`: its full hash, or an empty
 * string for a line not committed yet. One `git blame` per file, on the lines of its markers. A
 * file git cannot blame (not tracked yet) counts as not committed when the project is in a
 * repository; outside one, nothing is known.
 */
export function blamedLines(root: string, markers: readonly Remaining[], git: GitRunner): Map<string, string> {
  const blamed = new Map<string, string>();
  let inRepository: boolean | undefined;

  for (const [file, lines] of linesByFile(markers)) {
    const ranges = lines.flatMap((line) => ['-L', `${line},${line}`]);
    const output = git(root, ['blame', '--porcelain', ...ranges, '--', file]);

    if (output !== undefined) {
      for (const [, sha = '', line] of output.matchAll(HEADER)) {
        blamed.set(`${file}:${line}`, sha === NOT_COMMITTED ? '' : sha);
      }

      continue;
    }

    inRepository ??= git(root, ['rev-parse', '--is-inside-work-tree'])?.trim() === 'true';

    for (const line of inRepository ? lines : []) {
      blamed.set(`${file}:${line}`, '');
    }
  }

  return blamed;
}

function linesByFile(markers: readonly Remaining[]): Map<string, number[]> {
  const byFile = new Map<string, number[]>();

  for (const { file, line } of markers) {
    const lines = byFile.get(file) ?? [];

    byFile.set(file, lines.includes(line) ? lines : [...lines, line]);
  }

  return byFile;
}
