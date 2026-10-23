import type { BranchCommit } from './branch-commit';
import { findingsOf } from './findings-of';
import { markerLinesOf } from './marker-lines-of';
import type { Repository } from './repository';
import type { ReviewReading } from './review-reading';

/**
 * The `TODO(review)` lines the commits of the story removed (settled) and wrote (opened), read
 * from the diff of the commits `git log -S` says changed their number, and the findings of the
 * review file by pass.
 */
export function reviewReadingOf(
  repository: Repository,
  commits: readonly BranchCommit[],
  review: string | undefined,
): ReviewReading {
  const changing = new Set(
    (repository.git(repository.root, ['log', '--format=%H', '-S', 'TODO(review)', 'HEAD']) ?? '').split('\n'),
  );

  const diffs = commits.filter((commit) => changing.has(commit.sha)).map((commit) => markerLinesOf(repository, commit));
  const remarks = diffs.flatMap((diff) => diff.removed);
  const findings = findingsOf(review ?? '');
  const byPass: Record<string, number> = {};

  for (const { pass } of findings) {
    byPass[pass] = (byPass[pass] ?? 0) + 1;
  }

  return {
    settled: remarks.length,
    opened: diffs.reduce((sum, diff) => sum + diff.added, 0),
    remarks,
    findings: byPass,
    findingTexts: findings.map((finding) => finding.text),
  };
}
