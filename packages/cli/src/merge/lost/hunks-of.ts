import type { Hunk } from './hunk';

const FILE = /^\+\+\+ (?:b\/(.+)|\/dev\/null)$/;
const HUNK = /^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/;

/** The hunks of a unified diff, file by file; a deleted file has no entry, a quoted path is passed over. */
export function hunksOf(diff: string): Map<string, Hunk[]> {
  const hunks = new Map<string, Hunk[]>();
  let current: Hunk[] | undefined;

  for (const line of diff.split('\n')) {
    const file = FILE.exec(line);
    const hunk = file === null ? HUNK.exec(line) : null;

    if (file !== null) {
      current = file[1] === undefined ? undefined : listed(hunks, file[1]);
    } else if (hunk !== null && current !== undefined) {
      current.push(hunkOf(hunk));
    }
  }

  return hunks;
}

function listed(hunks: Map<string, Hunk[]>, file: string): Hunk[] {
  const list: Hunk[] = [];

  hunks.set(file, list);

  return list;
}

function hunkOf(match: RegExpExecArray): Hunk {
  return {
    oldStart: Number(match[1]),
    oldCount: match[2] === undefined ? 1 : Number(match[2]),
    newStart: Number(match[3]),
    newCount: match[4] === undefined ? 1 : Number(match[4]),
  };
}
