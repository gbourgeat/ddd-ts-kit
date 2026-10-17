import type { MergeFinding } from './merge-finding.js';
import type { MergeSides } from './merge-sides.js';
import { SPEC_FILE } from './spec-file.js';

/** The spec files of a side the result deleted, when neither side deleted them. */
export function deletedSpecs({ base, ours, theirs, result }: MergeSides): MergeFinding[] {
  return [...new Set([...ours.keys(), ...theirs.keys()])]
    .filter((file) => SPEC_FILE.test(file) && !result.has(file))
    .filter((file) => !(base.has(file) && (!ours.has(file) || !theirs.has(file))))
    .map(
      (file): MergeFinding => ({
        kind: 'spec-deleted',
        file,
        line: 1,
        side: sideOf(file, { base, ours }),
        text: 'spec file deleted by the merge',
      }),
    );
}

/** The side that added the spec; `both` when it was there before the merge's sides parted. */
function sideOf(file: string, { base, ours }: Pick<MergeSides, 'base' | 'ours'>): MergeFinding['side'] {
  if (base.has(file)) {
    return 'both';
  }

  return ours.has(file) ? 'ours' : 'theirs';
}
