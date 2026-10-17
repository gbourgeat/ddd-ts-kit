import { STORED_EVENTS_LOCK } from '../check/event-sourcing/stored-events-lock-file.js';
import { ADR_DIRECTORY } from '../check/governance/adr-directory.js';
import { runGit } from '../commit/run-git.js';
import { isDerived } from '../derived/is-derived.js';
import { SLICES_FILE } from '../progress/read-slices.js';
import { gitProcess } from './git-process.js';
import type { MergeRepository } from './lost/merge-repository.js';

const LOCKFILES = new Set(['package-lock.json', 'npm-shrinkwrap.json', 'pnpm-lock.yaml', 'yarn.lock', 'bun.lock']);

/** What committing the merge gave: the paths that blocked it, the commit, or why git refused. */
export interface MergeCommit {
  readonly leftOut: readonly string[];
  readonly commit?: string;
  readonly failure?: string;
}

/**
 * Commits the merge in progress with the message prepared for it, trailers included, and only
 * the paths of the merge: what is staged, plus what the steps of the merge rewrote (the derived
 * files, the migrations, the decision records, the lockfile, the slices file, the stored-events
 * lock). Any other changed path is left out and blocks the commit, as in verify-slice.
 */
export function commitMerge(repo: MergeRepository): MergeCommit {
  const { top } = repo;

  const changed = gitProcess(top, ['status', '--porcelain', '-z', '--untracked-files=all'])
    .stdout.split('\0')
    .filter((entry) => /^.. ./.test(entry) && entry[1] !== ' ')
    .map((entry) => entry.slice(3))
    .filter((file) => !/(?:^|\/)\.ddd-ts-kit\//.test(file));

  const ofTheMerge = changed.filter((file) => isMergePath(file, repo));
  const leftOut = changed.filter((file) => !ofTheMerge.includes(file));

  if (leftOut.length > 0) {
    return { leftOut };
  }

  if (ofTheMerge.length > 0) {
    gitProcess(
      top,
      ['--literal-pathspecs', 'add', '--all', '--pathspec-from-file=-', '--pathspec-file-nul'],
      `${ofTheMerge.join('\0')}\0`,
    );
  }

  const committed = gitProcess(top, ['commit', '--no-edit', '--quiet']);

  if (committed.status !== 0) {
    return {
      leftOut,
      failure: `${committed.stdout}${committed.stderr}`.trim().split('\n').slice(-20).join('\n') || 'git commit failed',
    };
  }

  return { leftOut, commit: runGit(top, ['rev-parse', 'HEAD'])?.trim() ?? '' };
}

function isMergePath(file: string, { prefix, contextsDir }: MergeRepository): boolean {
  const inProject = file.startsWith(prefix) ? file.slice(prefix.length) : undefined;

  return (
    inProject !== undefined &&
    (isDerived(inProject, { contextsDir }) ||
      /(?:^|\/)migrations\//.test(inProject) ||
      inProject.startsWith(`${ADR_DIRECTORY}/`) ||
      LOCKFILES.has(inProject.split('/').at(-1) ?? '') ||
      inProject === SLICES_FILE ||
      inProject === STORED_EVENTS_LOCK)
  );
}
