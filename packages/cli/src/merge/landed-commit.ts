import { runGit } from '../commit/run-git';
import { patchIdsOf } from './patch-ids-of';

/** The commits to try, newest first, and the trunk's patch ids to find them in. */
export interface LandedSearch {
  readonly commits: readonly string[];
  readonly trunk: string;
  /** The commits of the trunk since the fork, by stable patch id. */
  readonly landed: ReadonlyMap<string, string>;
  readonly pathspecs: readonly string[];
}

/** At most this many commits of one branch are tried: an older landing shows as conflicts, never as a loss. */
const MOST = 200;

/**
 * The commit whose whole change since the trunk (from their merge base with it) is the change of
 * one commit of the trunk, with that commit: a branch squash-merged up to it. Commits that change
 * only what the comparison leaves out (a slices file, a document, a migration) share the patch of
 * the commit before them: the oldest of them is taken, then a newer one only when the trunk holds
 * what it changed, so that a change made after the squash is never taken as landed.
 */
export function landedCommit(root: string, search: LandedSearch): { commit: string; on: string } | undefined {
  const commits = search.commits.slice(0, MOST);
  const patches = new Map<string, string | undefined>();

  const patchOf = (commit: string): string | undefined => {
    if (!patches.has(commit)) {
      patches.set(commit, patchFromTrunk(root, commit, search));
    }

    return patches.get(commit);
  };

  const newest = commits.findIndex((commit) => {
    const patch = patchOf(commit);

    return patch !== undefined && search.landed.has(patch);
  });

  const patch = newest === -1 ? undefined : patchOf(commits[newest] ?? '');
  const on = patch === undefined ? undefined : search.landed.get(patch);

  if (on === undefined) {
    return undefined;
  }

  const run = commits
    .slice(newest)
    .filter((commit, index, all) => all.slice(0, index + 1).every((one) => patchOf(one) === patch));

  return { commit: heldByTrunk(root, [...run].reverse(), search.trunk), on };
}

function patchFromTrunk(root: string, commit: string, { trunk, pathspecs }: LandedSearch): string | undefined {
  const fork = runGit(root, ['merge-base', trunk, commit])?.trim();

  return fork === undefined || fork === ''
    ? undefined
    : patchIdsOf(root, ['diff', fork, commit, '--', ...pathspecs])[0]?.[0];
}

/**
 * From the oldest of commits sharing one patch, the newest reached while the trunk holds each file
 * every step changed. A step that merged the trunk in changed, of its own, only the files where it
 * differs from what it brought: the others are lines of the trunk, which the trunk may have
 * changed again since, and they say nothing of what the branch landed.
 */
function heldByTrunk(root: string, oldestFirst: readonly string[], trunk: string): string {
  let held = oldestFirst[0] ?? '';

  for (const next of oldestFirst.slice(1)) {
    const changed = (runGit(root, ['diff', '--name-only', '-z', broughtIn(root, next, trunk) ?? held, next]) ?? '')
      .split('\0')
      .filter((file) => file !== '');

    const same =
      changed.length === 0 ||
      runGit(root, ['diff', '--quiet', next, trunk, '--', ...changed.map((file) => `:(top,literal)${file}`)]) !==
        undefined;

    if (!same) {
      break;
    }

    held = next;
  }

  return held;
}

/** What a merge commit brought in from the trunk: its second parent, when the trunk holds it. */
function broughtIn(root: string, commit: string, trunk: string): string | undefined {
  const [, , other] = (runGit(root, ['rev-list', '--parents', '--max-count=1', commit]) ?? '').trim().split(' ');

  return other !== undefined && runGit(root, ['merge-base', '--is-ancestor', other, trunk]) !== undefined
    ? other
    : undefined;
}
