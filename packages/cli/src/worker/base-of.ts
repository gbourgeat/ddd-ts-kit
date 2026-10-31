import fs from 'node:fs';
import path from 'node:path';
import { CliError } from '../cli-error';
import { knownCommit } from '../commit/known-commit';
import { runGit } from '../commit/run-git';
import { WORKER_SCOPE_FILE } from '../commit/worker-scope-file';
import type { Config } from '../config';

const FIX =
  'Fetch it first (`git fetch origin`), or pass a branch, a tag or a commit: `--base <branch, tag or commit>`.';

/** A base by the name the caller gave, which a briefing and a scope file keep, and the commit it names, which git is given. */
export interface Base {
  readonly name: string;
  readonly commit: string;
}

/**
 * The ref a worker's worktree is cut from and checked against: `--base` when given, which must
 * name a commit, or else the current branch. Without `--base`, refuses to run from the worktree
 * of a worker: its branch would become the trunk of the new one.
 */
export function baseOf(root: string, config: Config, base: string | undefined): Base {
  if (base !== undefined) {
    return { name: base, commit: knownCommit(root, base, FIX) };
  }

  const current = runGit(root, ['branch', '--show-current'])?.trim() || 'HEAD';
  const worker = workerBranch(root, config, current);

  if (worker !== undefined) {
    throw new CliError(
      `${root} is the worktree of a worker (${worker}): its branch ${current} would be the trunk of the new worker.`,
      'Run worker-scope from the checkout of the trunk, or name the base: `--base <branch, tag or commit>`.',
    );
  }

  return { name: current, commit: knownCommit(root, current, FIX) };
}

/** What makes the current checkout a worker's: its scope file, or a branch named `build/<context>`. */
function workerBranch(root: string, config: Config, current: string): string | undefined {
  if (fs.existsSync(path.join(root, WORKER_SCOPE_FILE))) {
    return `${WORKER_SCOPE_FILE} is present`;
  }

  const context = Object.keys(config.contexts).find((name) => current === `build/${name}`);

  return context === undefined ? undefined : `the branch of the worker of ${context}`;
}
