import { CliError } from '../cli-error';
import { acceptInMergeMessage } from './accept-in-merge-message';
import { inProgressMerge } from './lost/in-progress-merge';
import type { MergeRepository } from './lost/merge-repository';
import { verifyMerge } from './lost/verify-merge';
import type { LostLines } from './merge-report';

/**
 * verify-merge on the merge in progress, its result the index plus the working tree, judged on the
 * base its `Merge-Base:` trailer records. With `acceptLost`, what it reports is a removal someone
 * decided: recorded in a `Lost-Accepted:` trailer of the merge's message, then listed, not failing.
 */
export function lostLinesGate(repo: MergeRepository, acceptLost: boolean): LostLines {
  const first = checked(repo);

  if (!acceptLost || first.errors.length === 0) {
    return first;
  }

  acceptInMergeMessage(repo.top, [
    ...new Set(first.errors.map((finding) => (finding.line > 0 ? `${finding.file}:${finding.line}` : finding.file))),
  ]);

  return checked(repo);
}

function checked(repo: MergeRepository): LostLines {
  const merge = inProgressMerge(repo.top, undefined);

  if (merge === undefined) {
    throw new CliError('No merge is in progress in this worktree.', 'Run `npx ddd-ts-kit merge-trunk` to start one.');
  }

  const { errors, warnings, accepted } = verifyMerge(repo, merge);

  return { errors, warnings, accepted };
}
