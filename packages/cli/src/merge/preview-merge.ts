import { CliError } from '../cli-error.js';
import { gitProcess } from './git-process.js';

/** One side of a conflicted path, as the index of a merge holds it: 1 the base, 2 ours, 3 theirs. */
export interface StageEntry {
  readonly mode: string;
  readonly object: string;
  readonly stage: 1 | 2 | 3;
}

/** What merging two commits gives, computed without touching the working tree or the index. */
export interface MergePreview {
  /** The tree of the result, conflicted files written with their diff3 markers. */
  readonly tree: string;
  /** The stages of each conflicted path, from the top of the repository. */
  readonly conflicts: ReadonlyMap<string, readonly StageEntry[]>;
}

/** The two sides to merge and, when it is not the one git computes, the base. */
export interface PreviewRequest {
  readonly base?: string;
  readonly ours: string;
  /** Also how the conflict markers name the side of the trunk. */
  readonly theirs: string;
}

/**
 * `git merge-tree --write-tree`, ours first so that stage 2 is the branch and stage 3 the trunk,
 * with diff3 markers so that a conflict shows its base. With `base`, the merge is computed from
 * that commit: the changes of the branch since it, against the trunk.
 */
export function previewMerge(top: string, request: PreviewRequest): MergePreview {
  const { base, ours, theirs } = request;

  const merged = gitProcess(top, [
    '-c',
    'merge.conflictStyle=diff3',
    'merge-tree',
    '--write-tree',
    '-z',
    '--no-messages',
    ...(base === undefined ? [] : [`--merge-base=${base}`]),
    ours,
    theirs,
  ]);

  const [tree = '', ...entries] = merged.stdout.split('\0');

  if ((merged.status !== 0 && merged.status !== 1) || !/^[0-9a-f]{40,64}$/.test(tree)) {
    throw new CliError(
      `git merge-tree could not merge ${theirs} into ${ours}: ${merged.stderr.trim() || 'no output'}.`,
      'Check that both sides name commits (`git rev-parse <ref>`), and `git --version`: merge-trunk needs git 2.40 or later.',
    );
  }

  return { tree, conflicts: conflictsOf(entries) };
}

function conflictsOf(entries: readonly string[]): Map<string, StageEntry[]> {
  const conflicts = new Map<string, StageEntry[]>();

  for (const entry of entries) {
    const match = /^(\d+) ([0-9a-f]+) ([123])\t(.+)$/s.exec(entry);

    if (match !== null) {
      const [, mode = '', object = '', stage = '1', file = ''] = match;

      const level = stage === '2' ? 2 : stage === '3' ? 3 : 1;

      conflicts.set(file, [...(conflicts.get(file) ?? []), { mode, object, stage: level }]);
    }
  }

  return conflicts;
}
