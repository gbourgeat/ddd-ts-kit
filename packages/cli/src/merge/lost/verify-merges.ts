import { CliError } from '../../cli-error.js';
import { inProgressMerge } from './in-progress-merge.js';
import type { MergeCheck } from './merge-check.js';
import { mergeOfRecord } from './merge-of-record.js';
import { mergeRecords } from './merge-records.js';
import type { MergeRepository } from './merge-repository.js';
import { mergeRepositoryOf } from './merge-repository-of.js';
import type { MergeToVerify } from './merge-to-verify.js';
import type { MergeVerification } from './merge-verification.js';
import { mergesSince } from './merges-since.js';
import { sinceOf } from './since-of.js';
import { verifyMerge } from './verify-merge.js';

/** What the caller asks `verify-merge` to check. */
export interface MergesToVerify {
  /** The project root, or any directory of the worktree. */
  readonly root: string;
  /** One commit: a merge commit, or a squash commit with `theirs`. */
  readonly commit?: string;
  readonly since?: string;
  readonly theirs?: string;
  readonly base?: string;
}

/**
 * Checks the merges of a branch: one named commit, or else every merge commit since the trunk
 * plus the merge in progress. Reads git and the working tree, changes nothing.
 */
export function verifyMerges(request: MergesToVerify): MergeVerification {
  const repo = mergeRepositoryOf(request.root);
  const since = request.commit === undefined ? sinceOf(request.root, repo.top, request.since) : undefined;
  const merges = request.commit === undefined ? listed(repo, request, since) : [named(repo, request.commit, request)];

  return summarized(
    since,
    merges.map((merge) => verifyMerge(repo, merge)),
  );
}

function named(repo: MergeRepository, commit: string, request: MergesToVerify): MergeToVerify {
  const [record] = mergeRecords(repo.top, ['-1', commit, '--']);

  if (record === undefined) {
    throw new CliError(
      `${commit} is not a commit of this repository.`,
      'Pass a merge commit, or a squash commit with --theirs <branch head>.',
    );
  }

  return mergeOfRecord(repo.top, record, request);
}

function listed(repo: MergeRepository, request: MergesToVerify, since: string | undefined): MergeToVerify[] {
  if (request.theirs !== undefined) {
    throw new CliError(
      '--theirs names the branch a squash commit took in: it needs that commit.',
      'Name it: `ddd-ts-kit verify-merge <squash commit> --theirs <branch head>`.',
    );
  }

  const inProgress = inProgressMerge(repo.top, request.base);

  if (request.base !== undefined && inProgress === undefined) {
    throw new CliError(
      '--base is the base of one merge: a named commit, or the merge in progress, and none is in progress.',
      'Name the merge: `ddd-ts-kit verify-merge <merge commit> --base <commit>`.',
    );
  }

  return [
    ...(since === undefined ? [] : mergesSince(repo.top, since)),
    ...(inProgress === undefined ? [] : [inProgress]),
  ];
}

function summarized(since: string | undefined, merges: readonly MergeCheck[]): MergeVerification {
  const errorCount = merges.reduce((sum, merge) => sum + merge.errors.length, 0);

  return {
    ...(since === undefined ? {} : { since }),
    merges,
    errorCount,
    warningCount: merges.reduce((sum, merge) => sum + merge.warnings.length, 0),
    ok: errorCount === 0,
  };
}
