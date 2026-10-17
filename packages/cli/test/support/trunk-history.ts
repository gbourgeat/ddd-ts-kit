import fs from 'node:fs';
import path from 'node:path';
import { type CliResult, cli, tempDir, write } from '../helpers.js';
import { git } from './git.js';
import { withGitIdentity } from './git-identity.js';
import { commit, type Files } from './merge-repository.js';

export type { Files } from './merge-repository.js';

// merge-trunk commits through the git the CLI runs: it needs an identity on a runner without one.
withGitIdentity();

/** A throwaway repository on `main` holding `base`, its kit folder ignored. */
export function trunkRepository(base: Files): string {
  const root = fs.realpathSync(tempDir('merge-trunk'));

  git(root, 'init', '--quiet', '--initial-branch', 'main');
  commit(root, { '.gitignore': '.ddd-ts-kit/\nnode_modules/\n', ...base }, 'chore: base');

  return root;
}

/** Switches to `branch`, cut from `from` (the current commit by default) when it does not exist. */
export function onBranch(root: string, branch: string, from?: string): void {
  const exists = git(root, 'branch', '--list', branch).trim() !== '';

  git(root, 'switch', '--quiet', ...(exists ? [branch] : ['--create', branch, ...(from === undefined ? [] : [from])]));
}

/** Commits `files` on the current branch and answers the commit. */
export function commitFiles(root: string, files: Files, message: string): string {
  commit(root, files, message);

  return git(root, 'rev-parse', 'HEAD').trim();
}

/**
 * Squash-merges `branch` into `main` as a pull request would, `files` written over its result (the
 * resolution of a conflict, a renamed migration, a regenerated document), and answers the squash
 * commit. Leaves `main` checked out.
 */
export function squashInto(
  root: string,
  branch: string,
  { files = {}, message }: { files?: Files; message: string },
): string {
  onBranch(root, 'main');

  try {
    git(root, 'merge', '--quiet', '--squash', branch);
  } catch {
    // A conflict: `files` holds its resolution.
  }

  return commitFiles(root, files, message);
}

/** Writes the scope of the worker of this worktree, as worker-scope does. */
export function workerFile(root: string, scope: Readonly<Record<string, unknown>>): void {
  write(root, '.ddd-ts-kit/worker.json', JSON.stringify({ context: 'billing', ...scope }));
}

/** `merge-trunk --trunk main` with more arguments, from `root`. */
export function mergeTrunk(root: string, ...args: string[]): CliResult {
  return cli(root, 'merge-trunk', '--trunk', 'main', ...args);
}

/** `merge-trunk` with arguments that take no trunk (`--continue`, `--abort`). */
export function goOn(root: string, ...args: string[]): CliResult {
  return cli(root, 'merge-trunk', ...args);
}

/** Whether a merge is in progress in the repository. */
export function merging(root: string): boolean {
  return fs.existsSync(path.join(root, '.git', 'MERGE_HEAD'));
}

/** The message of the last commit. */
export function lastMessage(root: string): string {
  return git(root, 'log', '-1', '--format=%B');
}

/** The parents of the last commit. */
export function parents(root: string): string[] {
  return git(root, 'log', '-1', '--format=%P').trim().split(' ');
}
