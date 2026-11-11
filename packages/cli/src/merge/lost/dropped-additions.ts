import { runGit } from '../../commit/run-git';
import { isLineChecked } from './is-line-checked';
import type { MergeFinding } from './merge-finding';
import type { MergeRepository } from './merge-repository';
import { WORKTREE } from './revision-files';

/** The two sides of a merge, where they parted, and what the merge made of them. */
export interface PartedSides {
  /** Where the sides parted: what git computes, whatever base the merge was computed from. */
  readonly fork: string;
  readonly ours: string;
  readonly theirs: string;
  /** A commit, or {@link WORKTREE}. */
  readonly result: string;
}

/** The kinds that already say a file is gone from the result. */
const GONE: ReadonlySet<MergeFinding['kind']> = new Set(['file-deleted', 'spec-deleted']);

const TEXT = 'added on this side, its path never touched by the other: missing from the result';

/**
 * The files the first side added since the fork that the result lacks, while no commit of the
 * other side since the fork touched their path: nothing but the merge removed them. Read from the
 * fork, never from the base the merge was computed from: a base newer than what the other side
 * holds makes every file added before it look deleted by that side, and the lines agree. A file
 * the result holds under another path was moved; one `found` already reports is not repeated.
 */
export function droppedAdditions(
  repo: MergeRepository,
  { fork, ours, theirs, result }: PartedSides,
  found: readonly MergeFinding[],
): MergeFinding[] {
  const { top } = repo;
  const added = new Set(pathsOf(top, ['--diff-filter=A', fork, ours]));
  const reported = new Set(found.filter(({ kind }) => GONE.has(kind)).map(({ file }) => file));

  const gone = pathsOf(top, ['--diff-filter=D', ours, ...(result === WORKTREE ? [] : [result])]).filter(
    (file) => added.has(file) && !reported.has(file) && isLineChecked(file, repo),
  );

  if (gone.length === 0) {
    return [];
  }

  const kept = blobsOf(top, result);

  return gone
    .filter((file) => !kept.has(runGit(top, ['rev-parse', `${ours}:${file}`])?.trim() ?? ''))
    .filter((file) => !isTouched(top, `${fork}..${theirs}`, file))
    .map((file): MergeFinding => ({ kind: 'file-deleted', file, line: 1, side: 'ours', text: TEXT }));
}

function pathsOf(top: string, range: readonly string[]): string[] {
  return (runGit(top, ['diff', '--name-only', '-z', '--no-renames', ...range]) ?? '')
    .split('\0')
    .filter((file) => file !== '');
}

/** The blobs the result holds, at any path: those of its tree, or of the index for a merge in progress. */
function blobsOf(top: string, result: string): Set<string> {
  const listed = runGit(top, result === WORKTREE ? ['ls-files', '--stage'] : ['ls-tree', '-r', result]) ?? '';

  return new Set(listed.split('\n').flatMap((line) => /\b[0-9a-f]{40,64}\b/.exec(line)?.[0] ?? []));
}

/** Whether a commit of the range changed the path. */
function isTouched(top: string, range: string, file: string): boolean {
  return (runGit(top, ['log', '-1', '--format=%H', range, '--', `:(top,literal)${file}`]) ?? '').trim() !== '';
}
