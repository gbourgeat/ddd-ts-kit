import fs from 'node:fs';
import path from 'node:path';
import { CliError } from '../cli-error';
import { runGit } from '../commit/run-git';
import { WORKER_SCOPE_FILE } from '../commit/worker-scope-file';
import { listWorktrees } from './list-worktrees';
import { readWorkerFile } from './read-worker-file';
import type { WorkerFile } from './worker-file';
import { askedWorktree } from './asked-worktree';

/** Which worker of a context: the only one, or the one of a worktree or a branch. */
export interface WorkerChoice {
  readonly context: string;
  readonly worktree?: string;
  readonly branch?: string;
}

/** A worker found in a worktree of the repository. */
export interface FoundWorker {
  /** Absolute path of the worktree. */
  readonly worktree: string;
  /** Absolute path of the project inside it. */
  readonly project: string;
  readonly branch: string | undefined;
  readonly scope: WorkerFile;
}

/**
 * The worker of a context among the worktrees of the repository of `root`, read from their scope
 * files. Refuses when none builds the context, and when several do without `--worktree` or
 * `--branch` to choose: it names them.
 */
export function findWorker(root: string, choice: WorkerChoice): FoundWorker {
  const prefix = runGit(root, ['rev-parse', '--show-prefix'])?.trim() ?? '';

  const workers = listWorktrees(root).flatMap((worktree): FoundWorker[] => {
    const project = path.join(worktree.path, prefix);
    const scope = readWorkerFile(path.join(project, WORKER_SCOPE_FILE));

    return scope?.context === choice.context
      ? [{ worktree: worktree.path, project, branch: worktree.branch ?? scope.branch, scope }]
      : [];
  });

  const chosen = workers.filter((worker) => isChosen(root, worker, choice));
  const [only] = chosen;

  if (only === undefined) {
    throw new CliError(
      `No worktree of this repository builds ${choice.context}${workers.length > 0 ? ' at that place' : ''}.`,
      `\`npx ddd-ts-kit status --workers\` lists the workers; \`npx ddd-ts-kit worker-scope ${choice.context} --rows <id>\` prepares one.`,
    );
  }

  if (chosen.length > 1) {
    throw new CliError(
      `${chosen.length} worktrees build ${choice.context}: ${chosen.map((worker) => worker.worktree).join(', ')}.`,
      `Name the one to resume: \`npx ddd-ts-kit worker-scope ${choice.context} --resume --worktree <path>\` (or --branch <name>).`,
    );
  }

  return only;
}

function isChosen(root: string, worker: FoundWorker, choice: WorkerChoice): boolean {
  if (choice.branch !== undefined && worker.branch !== choice.branch) {
    return false;
  }

  if (choice.worktree === undefined) {
    return true;
  }

  const asked = askedWorktree(root, choice.worktree);

  return fs.existsSync(asked) && fs.realpathSync(asked) === fs.realpathSync(worker.worktree);
}
