import fs from 'node:fs';
import path from 'node:path';
import { runGit } from '../commit/run-git.js';
import { SLICES_FILE } from '../progress/read-slices.js';
import { slicesIn } from '../progress/slices-in.js';
import { WORKER_SCOPE_FILE } from '../commit/worker-scope-file.js';
import { type BranchStanding, branchStanding } from './branch-standing.js';
import { changedFiles } from './changed-files.js';
import { listWorktrees, type Worktree } from './list-worktrees.js';
import { overlapsOf } from './overlaps-of.js';
import { progressOf } from './progress-of.js';
import { readWorkerFile } from './read-worker-file.js';
import type { WorkerFile } from './worker-file.js';
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
  // A scope file written before the rows were recorded has no rows to follow.
  const progress = scope.rows === undefined ? undefined : progressOf(project, scope);
  const standing = standingIn(worktree, project, scope);

  return [
    {
      worktree: worktree.path,
      ...(branch === undefined ? {} : { branch }),
      context: scope.context,
      ...(scope.rows === undefined ? {} : { rows: scope.rows }),
      ...(scope.base === undefined ? {} : { base: scope.base }),
      ...standingOf(standing, landedRows(project, { standing, scope })),
      installed: fs.existsSync(path.join(project, 'node_modules')),
      files: changedFiles(worktree.path, standing?.since),
      report: reportIn(project),
      ...(progress === undefined ? {} : { progress }),
    },
  ];
}

/** Where the branch of the worker stands against its base; nothing without a base. */
function standingIn(worktree: Worktree, project: string, { base }: WorkerFile): BranchStanding | undefined {
  return base === undefined ? undefined : branchStanding(worktree.path, project, base);
}

/** What the status says of the standing: nothing when the base is unknown or names no commit. */
function standingOf(
  standing: BranchStanding | undefined,
  rows: readonly string[],
): Pick<WorkerStatus, 'ahead' | 'behind' | 'landed' | 'mergePreview'> {
  if (standing === undefined) {
    return {};
  }

  const { ahead, behind, landed, mergePreview } = standing;
  const where = landed === undefined ? {} : { landed: { commit: landed.commit, subject: landed.subject, rows } };

  return { ahead, behind, ...where, ...(mergePreview === undefined ? {} : { mergePreview }) };
}

/** The briefed rows the branch had done where it landed: on the trunk, whatever the trunk's slices file says. */
function landedRows(
  project: string,
  { standing, scope }: { standing: BranchStanding | undefined; scope: WorkerFile },
): string[] {
  if (standing?.landed === undefined) {
    return [];
  }

  const done = (slicesIn(runGit(project, ['show', `${standing.since}:./${SLICES_FILE}`]) ?? '') ?? []).filter(
    (row) => row.status === 'done',
  );

  return (scope.rows ?? []).filter((id) => done.some((row) => row.id === id));
}

function reportIn(project: string): WorkerReport | null {
  const file = path.join(project, REPORT_FILE);

  return fs.existsSync(file) ? { file, modified: fs.statSync(file).mtime.toISOString() } : null;
}
