import { SLICES_FILE } from '../progress/read-slices';
import type { MergeRepository } from './lost/merge-repository';
import { revisionFiles } from './lost/revision-files';
import { mergeSlicesRows } from './merge-slices-rows';
import type { Resolution } from './resolution';

/** The merge whose slices file is read: its base, where the branch left the trunk, both sides, and the tree it wrote. */
export interface RowsToMerge {
  readonly base: string;
  readonly fork: string;
  readonly ours: string;
  readonly theirs: string;
  readonly tree: string;
}

const HOW =
  'slices rows: merged row by row from where the branch left the trunk, each status the furthest of both sides';

/**
 * The slices file merged row by row from the fork, for a merge computed from a newer base whose
 * slices file is not the fork's. That base is found without the slices file: it may hold a row,
 * or a cell, the trunk never took, which a merge from it reads as removed by the trunk. Undefined
 * when the base is the fork or holds the same file, when a side has none, when the rows do not
 * settle from the fork (the merge from the base stands, and the gate reads it), and when the
 * merge already wrote that text.
 */
export function slicesFromFork(repo: MergeRepository, merge: RowsToMerge): Resolution | undefined {
  if (merge.base === merge.fork) {
    return undefined;
  }

  const file = `${repo.prefix}${SLICES_FILE}`;
  const read = (revision: string): string | undefined => revisionFiles(repo.top, revision, [file]).get(file);
  const [forked, ours, theirs] = [read(merge.fork), read(merge.ours), read(merge.theirs)];

  const rows =
    forked === read(merge.base) || ours === undefined || theirs === undefined
      ? undefined
      : mergeSlicesRows(forked ?? '', ours, theirs);

  return rows === undefined || !('text' in rows) || rows.text === read(merge.tree)
    ? undefined
    : { file, kind: 'slices', content: rows.text, settled: true, how: HOW, blocks: [] };
}

/** The resolutions with that of the rows: in place of the one the slices file had as a conflicted path, else added. */
export function withRows(resolutions: readonly Resolution[], rows: Resolution | undefined): Resolution[] {
  return rows === undefined ? [...resolutions] : [...resolutions.filter(({ file }) => file !== rows.file), rows];
}
