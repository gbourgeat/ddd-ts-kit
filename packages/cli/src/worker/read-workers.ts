import fs from 'node:fs';
import path from 'node:path';
import { runGit } from '../commit/run-git.js';
import { WORKER_SCOPE_FILE } from '../commit/worker-scope-file.js';
import { changedFiles } from './changed-files.js';
import { listWorktrees, type Worktree } from './list-worktrees.js';
import { overlapsOf } from './overlaps-of.js';
import { readWorkerFile } from './read-worker-file.js';
import { REPORT_FILE } from './report-file.js';
import type { WorkerReport, WorkerStatus, WorkersStatus } from './workers-status.js';

/**
 * The workers of a parallel build, read from the worktrees of the repository of the project at
 * `root`: each worktree whose copy of the project holds a scope file is one. Reads git and the
 * files, changes nothing.
 */
export function readWorkers(root: string): WorkersStatus {
  const prefix = runGit(root, ['rev-parse', '--show-prefix'])?.trim();

  const workers =
    prefix === undefined
      ? []
      : listWorktrees(root).flatMap((worktree) => workerIn(worktree, path.join(worktree.path, prefix)));

  return { workers, overlaps: overlapsOf(workers) };
}

/** The worker of one worktree, whose project is at `project`; none without a readable scope file. */
function workerIn(worktree: Worktree, project: string): WorkerStatus[] {
  const scope = readWorkerFile(path.join(project, WORKER_SCOPE_FILE));

  if (scope === undefined) {
    return [];
  }

  const branch = worktree.branch ?? scope.branch;
  const { ahead, mergeBase } = sinceBase(worktree.path, scope.base);

  return [
    {
      worktree: worktree.path,
      ...(branch === undefined ? {} : { branch }),
      context: scope.context,
      ...(scope.rows === undefined ? {} : { rows: scope.rows }),
      ...(scope.base === undefined ? {} : { base: scope.base }),
      ...(ahead === undefined ? {} : { ahead }),
      installed: fs.existsSync(path.join(project, 'node_modules')),
      files: changedFiles(worktree.path, mergeBase),
      report: reportIn(project),
    },
  ];
}

/** Where the worktree stands against its base; nothing when the base is unknown or names no commit. */
function sinceBase(worktree: string, base: string | undefined): { ahead?: number; mergeBase?: string } {
  if (base === undefined) {
    return {};
  }

  const mergeBase = runGit(worktree, ['merge-base', base, 'HEAD'])?.trim();
  const ahead = runGit(worktree, ['rev-list', '--count', `${base}..HEAD`]);

  return mergeBase === undefined || ahead === undefined ? {} : { ahead: Number(ahead.trim()), mergeBase };
}

function reportIn(project: string): WorkerReport | null {
  const file = path.join(project, REPORT_FILE);

  return fs.existsSync(file) ? { file, modified: fs.statSync(file).mtime.toISOString() } : null;
}
