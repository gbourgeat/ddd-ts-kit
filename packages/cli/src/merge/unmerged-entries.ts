import { gitProcess } from './git-process.js';
import type { StageEntry } from './preview-merge.js';

/** The stages of each path the index holds unmerged, from the top of the repository. */
export function unmergedEntries(top: string): Map<string, StageEntry[]> {
  const entries = new Map<string, StageEntry[]>();

  for (const entry of gitProcess(top, ['ls-files', '-u', '-z']).stdout.split('\0')) {
    const match = /^(\d+) ([0-9a-f]+) ([123])\t(.+)$/s.exec(entry);

    if (match !== null) {
      const [, mode = '', object = '', stage = '1', file = ''] = match;
      const level = stage === '2' ? 2 : stage === '3' ? 3 : 1;

      entries.set(file, [...(entries.get(file) ?? []), { mode, object, stage: level }]);
    }
  }

  return entries;
}
