import type { BranchCommit } from './branch-commit';
import type { Repository } from './repository';

const MARKER = /TODO\(review\)\s*:?\s*(.*)$/;
const ROW = /#?[A-Za-z]*\d+(?:\.\d+)+\s*/g;

/** The `TODO(review)` lines a commit removed, each without its row id, and how many it added. */
export function markerLinesOf(repository: Repository, commit: BranchCommit): { removed: string[]; added: number } {
  const lines = (repository.git(repository.root, ['show', '--format=', '--unified=0', commit.sha]) ?? '').split('\n');

  return { removed: markers(lines, '-'), added: markers(lines, '+').length };
}

function markers(lines: readonly string[], sign: string): string[] {
  return lines
    .filter((line) => line.startsWith(sign) && !line.startsWith(sign.repeat(3)))
    .flatMap((line) => {
      const text = MARKER.exec(line)?.[1];

      return text === undefined ? [] : [text.replace(ROW, '').trim()];
    });
}
