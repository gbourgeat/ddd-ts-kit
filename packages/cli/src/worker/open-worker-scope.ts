import fs from 'node:fs';
import path from 'node:path';
import { CliError } from '../cli-error.js';
import { runGit } from '../commit/run-git.js';
import { WORKER_SCOPE_FILE } from '../commit/worker-scope-file.js';
import type { Config } from '../config/index.js';
import { KINDS } from '../generate/kinds.js';
import { Workspace } from '../workspace/index.js';
import { briefedRows } from './briefed-rows.js';
import { briefingOf } from './briefing-of.js';
import { ensureContainsBase } from './ensure-contains-base.js';
import { listWorktrees } from './list-worktrees.js';
import { baseOf } from './base-of.js';
import type { WorkerScope } from './worker-scope.js';
import type { WorkerFile } from './worker-file.js';
import { workerGenerators } from './worker-generators.js';

/** What the caller asks for one worker. */
export interface WorkerRequest {
  readonly context: string;
  /** The worktree directory, relative to the project root; by default `../<project>-<context>`. */
  readonly worktree?: string;
  /** By default `build/<context>`. */
  readonly branch?: string;
  /** The ref the worktree is cut from and checked against; by default the current branch. */
  readonly base?: string;
  /** The ids of the rows to brief, in this order; by default every row of the context still to do. */
  readonly rows?: readonly string[];
  readonly dryRun: boolean;
}

/**
 * Gives one worker its place: a git worktree of the project on its own branch, cut from the
 * base, the file that confines it to its context, and its briefing. An existing worktree or
 * branch is kept when it contains the base: only the file is written again.
 */
export function openWorkerScope(root: string, config: Config, request: WorkerRequest): WorkerScope {
  const { context, dryRun } = request;
  const { project, worktree, branch, trunk, created, inside } = placeOf(root, config, request);
  const { slices, notes } = briefedRows(new Workspace(root, false), context, request.rows);

  if (created && !dryRun) {
    addWorktree(root, { worktree, branch, base: trunk });
  }

  if (!dryRun) {
    writeScope(inside, { context, rows: slices.map((row) => row.id), base: trunk, branch });
  }

  const generators = workerGenerators(KINDS);
  const briefing = briefingOf({ config, context, project, root: inside, branch, trunk, generators, slices });

  return {
    dryRun,
    context,
    project,
    worktree,
    root: inside,
    branch,
    trunk,
    created,
    scopeFile: path.join(inside, WORKER_SCOPE_FILE),
    generators,
    slices,
    briefing,
    notes: [...notes, ...notesOf(root, dryRun ? root : inside)],
  };
}

/** Where the worker works: its worktree, its branch, and the project inside that worktree. */
interface Place {
  readonly project: string;
  readonly worktree: string;
  readonly branch: string;
  readonly trunk: string;
  /** False when the worktree is already one of the repository. */
  readonly created: boolean;
  readonly inside: string;
}

function placeOf(root: string, config: Config, request: WorkerRequest): Place {
  const prefix = prefixOf(root);
  const trunk = baseOf(root, config, request.base);
  const project = path.basename(root);
  const worktree = path.resolve(root, request.worktree ?? `../${project}-${request.context}`);
  const branch = request.branch ?? `build/${request.context}`;
  const created = !isWorktree(root, worktree);

  if (!created) {
    ensureContainsBase(worktree, runGit(worktree, ['branch', '--show-current'])?.trim() || 'HEAD', trunk);
  } else if (branchExists(root, branch)) {
    ensureContainsBase(root, branch, trunk);
  }

  return {
    project,
    worktree,
    branch,
    trunk,
    created,
    inside: path.join(worktree, prefix),
  };
}

/** The path of the project inside its repository, empty at its top. */
function prefixOf(root: string): string {
  const prefix = runGit(root, ['rev-parse', '--show-prefix']);

  if (prefix === undefined) {
    throw new CliError(
      `${root} is not inside a git repository.`,
      'Run `git init` and make a first commit: a worktree is cut from a commit.',
    );
  }

  if (runGit(root, ['rev-parse', '--verify', '--quiet', 'HEAD']) === undefined) {
    throw new CliError(
      'The repository has no commit yet.',
      'Commit the bootstrap first: a worktree is cut from a commit.',
    );
  }

  return prefix.trim();
}

function isWorktree(root: string, worktree: string): boolean {
  if (!fs.existsSync(worktree)) {
    return false;
  }

  const known = listWorktrees(root).map((listed) => listed.path);

  if (known.includes(fs.realpathSync(worktree))) {
    return true;
  }

  throw new CliError(
    `${worktree} exists and is not a worktree of this repository.`,
    'Pass another directory with --worktree <path>, or remove that one.',
  );
}

function branchExists(root: string, branch: string): boolean {
  return runGit(root, ['rev-parse', '--verify', '--quiet', `refs/heads/${branch}`]) !== undefined;
}

/** Adds the worktree on its branch: an existing branch is checked out, a new one is cut from the base. */
function addWorktree(root: string, place: { worktree: string; branch: string; base: string }): void {
  const { worktree, branch, base } = place;
  const target = branchExists(root, branch) ? [branch] : ['-b', branch, base];
  const added = runGit(root, ['worktree', 'add', worktree, ...target]);

  if (added === undefined) {
    throw new CliError(
      `git could not add the worktree ${worktree} on the branch ${branch}.`,
      `Run \`git worktree add ${worktree} ${target.join(' ')}\` to read its reason; a branch checked out elsewhere takes --branch <name>.`,
    );
  }
}

/** The guard of the plugin reads `context`; `status --workers` shows the rest. */
function writeScope(inside: string, scope: WorkerFile): void {
  const file = path.join(inside, WORKER_SCOPE_FILE);

  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${JSON.stringify(scope, null, 2)}\n`);
}

function notesOf(root: string, inside: string): string[] {
  const ignored = runGit(inside, ['check-ignore', '--quiet', WORKER_SCOPE_FILE]) !== undefined;
  const installed = fs.existsSync(path.join(inside, 'node_modules')) || inside === root;

  return [
    ...(ignored
      ? []
      : [
          `${WORKER_SCOPE_FILE} is not ignored: add \`.ddd-ts-kit/\` to .gitignore on the trunk, so that no worker commits its scope.`,
        ]),
    ...(installed
      ? []
      : [`Install the dependencies in the worktree before the worker starts: \`cd ${inside} && npm ci\`.`]),
  ];
}
