import { runGit } from '../../commit/run-git';
import { SLICES_FILE } from '../../progress/read-slices';
import { changedPaths } from './changed-paths';
import { commitOf } from '../../commit/commit-of';
import { conflictMarkers } from './conflict-markers';
import { deletedSpecs } from './deleted-specs';
import { isGeneratedText } from './is-generated-text';
import { isLineChecked } from './is-line-checked';
import { keptRows } from './kept-rows';
import { lineFindings, type MergeChanges } from './line-findings';
import { lostMigrations } from './lost-migrations';
import { lostTests } from './lost-tests';
import type { MergeCheck } from './merge-check';
import type { MergeFinding } from './merge-finding';
import type { MergeRepository } from './merge-repository';
import type { MergeSides } from './merge-sides';
import type { MergeToVerify } from './merge-to-verify';
import { revisionFiles, WORKTREE } from './revision-files';
import { sideHunks } from './side-hunks';
import { untouchedByBranch } from './untouched-by-branch';

const WARNINGS: ReadonlySet<MergeFinding['kind']> = new Set(['revived', 'rewritten', 'superseded']);

/**
 * Checks one merge against its base and its two sides: the lines, rows, tests, spec files and
 * migrations it lost, the conflict markers it left, the lines it brought back. For a merge
 * older than HEAD, an error HEAD no longer shows was repaired by a later commit; an error its
 * `Lost-Accepted:` trailer names was decided. Neither fails.
 */
export function verifyMerge(repo: MergeRepository, merge: MergeToVerify): MergeCheck {
  const findings = findingsAt(repo, merge, { result: merge.commit ?? WORKTREE, since: [] });
  const later = laterKeys(repo, merge);
  const errors = findings.filter((finding) => !WARNINGS.has(finding.kind));
  const repaired = later === undefined ? [] : errors.filter((finding) => !later.has(keyOf(finding)));
  const standing = errors.filter((finding) => !repaired.includes(finding));
  const accepted = standing.filter((finding) => isAccepted(finding, merge.accepted));
  const { commit, subject, base, baseFrom, ours, theirs } = merge;

  return {
    ...(commit === undefined ? {} : { commit }),
    subject,
    base,
    baseFrom,
    ours,
    theirs,
    errors: standing.filter((finding) => !accepted.includes(finding)),
    warnings: findings.filter((finding) => WARNINGS.has(finding.kind)),
    accepted,
    repaired,
  };
}

/** What a merge lost, judged at `result`; `since` adds the pairs of revisions whose changes widen the scope. */
function findingsAt(
  repo: MergeRepository,
  merge: MergeToVerify,
  at: { result: string; since: ReadonlyArray<readonly [string, string]> },
): MergeFinding[] {
  const { base, ours, theirs } = merge;
  const pairs = [[base, ours], [base, theirs], [ours, at.result], [theirs, at.result], ...at.since] as const;
  const paths = changedPaths(repo.top, pairs);
  const read = (revision: string): Map<string, string> => revisionFiles(repo.top, revision, paths);
  const sides: MergeSides = { base: read(base), ours: read(ours), theirs: read(theirs), result: read(at.result) };

  const findings = [
    ...lineFindings(linesOf(sides, repo), changesOf(repo.top, merge, at.result)),
    ...keptRows(sides, `${repo.prefix}${SLICES_FILE}`),
    ...lostTests(sides),
    ...deletedSpecs(sides),
    ...lostMigrations(sides),
    ...conflictMarkers(sides),
  ];

  const fork = runGit(repo.top, ['merge-base', ours, theirs])?.trim();

  return fork === undefined || fork === ''
    ? findings
    : untouchedByBranch(findings, { ours: sides.ours, fork: read(fork) });
}

/** The hunks of each side against the base, and from each side to the result. */
function changesOf(top: string, { base, ours, theirs }: MergeToVerify, result: string): MergeChanges {
  return {
    fromBase: { ours: sideHunks(top, base, ours), theirs: sideHunks(top, base, theirs) },
    toResult: { ours: sideHunks(top, ours, result), theirs: sideHunks(top, theirs, result) },
  };
}

/** The files whose lines are compared: checked by their path, and written by no tool on any side. */
function linesOf(sides: MergeSides, repo: MergeRepository): MergeSides {
  const all = [sides.base, sides.ours, sides.theirs, sides.result];

  const generated = new Set(
    all.flatMap((files) => [...files].filter(([, content]) => isGeneratedText(content))).map(([file]) => file),
  );

  const kept = (files: ReadonlyMap<string, string>): Map<string, string> =>
    new Map([...files].filter(([file]) => isLineChecked(file, repo) && !generated.has(file)));

  return { base: kept(sides.base), ours: kept(sides.ours), theirs: kept(sides.theirs), result: kept(sides.result) };
}

/** The findings of a committed merge judged at HEAD, when HEAD is a later commit of its branch. */
function laterKeys(repo: MergeRepository, merge: MergeToVerify): Set<string> | undefined {
  const head = commitOf(repo.top, 'HEAD');
  const { commit } = merge;

  if (commit === undefined || head === undefined || head === commit) {
    return undefined;
  }

  if (runGit(repo.top, ['merge-base', '--is-ancestor', commit, head]) === undefined) {
    return undefined;
  }

  return new Set(findingsAt(repo, merge, { result: head, since: [[commit, head]] }).map(keyOf));
}

/** A finding at HEAD is the same one when it points at the same place of a side; a marker, in the same file. */
function keyOf({ kind, file, line, text }: MergeFinding): string {
  if (kind === 'conflict-marker') {
    return `${kind}|${file}`;
  }

  return `${kind === 'rewritten' || kind === 'superseded' ? 'lost-line' : kind}|${file}|${line}|${text}`;
}

function isAccepted({ file, line }: MergeFinding, entries: readonly string[]): boolean {
  return entries.some((entry) => entry === file || entry === `${file}:${line}`);
}
