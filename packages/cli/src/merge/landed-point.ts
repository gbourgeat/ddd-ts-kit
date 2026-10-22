import { CliError } from '../cli-error';
import { runGit } from '../commit/run-git';
import type { BasePoint } from './base-point';
import type { BaseQuery } from './base-query';
import { landedCommit } from './landed-commit';
import { commitOf } from './lost/commit-of';
import { mergeExclusions } from './merge-exclusions';
import { patchIdsOf } from './patch-ids-of';
import { recordedBase } from './recorded-base';
import { type SharingBranch, sharingBranches } from './sharing-branches';

/**
 * The landed point: `--since`; else the newest commit of the branch, or of a branch it shares
 * commits with, whose patch is one commit of the trunk; else the base recorded for the worker
 * when its lines are on the trunk; else `git merge-base`.
 */
export function landedPoint(query: BaseQuery): BasePoint {
  const { root, head, trunk } = query;

  if (query.since !== undefined) {
    return { commit: sinceCommit(root, query.since, head), evidence: 'option' };
  }

  const fork = runGit(root, ['merge-base', head, trunk])?.trim() ?? '';

  const branches = sharingBranches(root, {
    head,
    trunk,
    ...(query.worker?.base === undefined ? {} : { parent: query.worker.base }),
  });

  const landed = landedOf(query, fork, branches);

  if (landed !== undefined) {
    return landed;
  }

  return (
    recordedBase(query, fork) ?? {
      commit: fork,
      evidence: 'merge-base',
      unlanded: branches.map(({ name, since }) => ({ branch: name, since })),
    }
  );
}

function sinceCommit(root: string, since: string, head: string): string {
  const commit = commitOf(root, since);

  if (commit === undefined || runGit(root, ['merge-base', '--is-ancestor', commit, head]) === undefined) {
    throw new CliError(
      `--since ${since} is not a commit of this branch.`,
      'Pass the newest commit of this branch the trunk already holds: `--since <commit>` (`git log --oneline` lists them).',
    );
  }

  return commit;
}

function landedOf(query: BaseQuery, fork: string, branches: readonly SharingBranch[]): BasePoint | undefined {
  const { root, head, trunk } = query;
  const pathspecs = mergeExclusions(query.repo.contextsDir);
  const log = ['log', '--first-parent', '--format=commit %H', `${fork}..${trunk}`, '--', ...pathspecs];
  const landed = new Map(patchIdsOf(root, log));

  if (landed.size === 0) {
    return undefined;
  }

  const chain = lines(runGit(root, ['rev-list', '--first-parent', head, `^${trunk}`]));
  const onHead = new Set(chain);
  const search = { trunk, landed, pathspecs };

  const found = [
    pointOf(root, landedCommit(root, { ...search, commits: chain }), { onHead: true, from: 'this branch' }),
    ...branches.map((branch) => {
      const commits = lines(runGit(root, ['rev-list', '--first-parent', branch.tip, `^${trunk}`])).filter(
        (commit) => !onHead.has(commit),
      );

      return pointOf(root, landedCommit(root, { ...search, commits }), { onHead: false, from: branch.name });
    }),
  ].filter((point) => point !== undefined);

  return found.reduce<BasePoint | undefined>(
    (newest, point) => (newest === undefined || isAncestor(root, newest.commit, point.commit) ? point : newest),
    undefined,
  );
}

function pointOf(
  root: string,
  match: { commit: string; on: string } | undefined,
  { onHead, from }: { onHead: boolean; from: string },
): BasePoint | undefined {
  if (match === undefined) {
    return undefined;
  }

  const commit = onHead ? match.commit : (runGit(root, ['merge-base', 'HEAD', match.commit])?.trim() ?? match.commit);
  const subject = runGit(root, ['log', '-1', '--format=%s', match.on])?.trim() ?? '';

  return {
    commit,
    evidence: 'landed',
    landedAs: { commit: match.on, subject, from: onHead ? `this branch up to ${match.commit.slice(0, 7)}` : from },
  };
}

function isAncestor(root: string, older: string, newer: string): boolean {
  return runGit(root, ['merge-base', '--is-ancestor', older, newer]) !== undefined;
}

function lines(output: string | undefined): string[] {
  return (output ?? '').split('\n').filter((line) => line !== '');
}
