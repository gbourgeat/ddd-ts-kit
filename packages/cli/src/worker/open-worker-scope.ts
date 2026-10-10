import fs from 'node:fs';
import path from 'node:path';
import { CliError } from '../cli-error.js';
import { runGit } from '../commit/run-git.js';
import { WORKER_SCOPE_FILE } from '../commit/worker-scope-file.js';
import type { Config } from '../config/index.js';
import { KINDS } from '../generate/kinds.js';
import { readSlices } from '../progress/read-slices.js';
import type { Slice } from '../progress/slice.js';
import { Workspace } from '../workspace/index.js';
import { briefingOf } from './briefing-of.js';
import type { WorkerScope } from './worker-scope.js';
import { workerGenerators } from './worker-generators.js';

/** What the caller asks for one worker. */
export interface WorkerRequest {
  readonly context: string;
  /** The worktree directory, relative to the project root; by default `../<project>-<context>`. */
  readonly worktree?: string;
  /** By default `build/<context>`. */
  readonly branch?: string;
  readonly dryRun: boolean;
}

/**
 * Gives one worker its place: a git worktree of the project on its own branch, the file that
 * confines it to its context, and its briefing. An existing worktree is kept: only the file is
 * written again.
 */
export function openWorkerScope(root: string, config: Config, request: WorkerRequest): WorkerScope {
  const { context, dryRun } = request;
  const { project, worktree, branch, trunk, created, inside } = placeOf(root, request);

  if (created && !dryRun) {
    addWorktree(root, worktree, branch);
  }

  if (!dryRun) {
    writeScope(inside, context);
  }

  const slices = todoSlices(root, context);
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
    notes: notesOf(root, dryRun ? root : inside),
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

function placeOf(root: string, request: WorkerRequest): Place {
  const repository = repositoryOf(root);
  const project = path.basename(root);
  const worktree = path.resolve(root, request.worktree ?? `../${project}-${request.context}`);
  const branch = request.branch ?? `build/${request.context}`;
  const created = !isWorktree(root, worktree);

  return {
    project,
    worktree,
    branch,
    trunk: repository.trunk,
    created,
    inside: path.join(worktree, repository.prefix),
  };
}

interface Repository {
  /** The current branch; `HEAD` when none is checked out. */
  readonly trunk: string;
  /** The path of the project inside its repository, empty at its top. */
  readonly prefix: string;
}

function repositoryOf(root: string): Repository {
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

  return { trunk: runGit(root, ['branch', '--show-current'])?.trim() || 'HEAD', prefix: prefix.trim() };
}

function isWorktree(root: string, worktree: string): boolean {
  if (!fs.existsSync(worktree)) {
    return false;
  }

  const known = (runGit(root, ['worktree', 'list', '--porcelain']) ?? '')
    .split('\n')
    .filter((line) => line.startsWith('worktree '))
    .map((line) => line.slice('worktree '.length));

  if (known.includes(fs.realpathSync(worktree))) {
    return true;
  }

  throw new CliError(
    `${worktree} exists and is not a worktree of this repository.`,
    'Pass another directory with --worktree <path>, or remove that one.',
  );
}

function addWorktree(root: string, worktree: string, branch: string): void {
  const exists = runGit(root, ['rev-parse', '--verify', '--quiet', `refs/heads/${branch}`]) !== undefined;
  const added = runGit(root, ['worktree', 'add', worktree, ...(exists ? [branch] : ['-b', branch])]);

  if (added === undefined) {
    throw new CliError(
      `git could not add the worktree ${worktree} on the branch ${branch}.`,
      `Run \`git worktree add ${worktree} ${exists ? branch : `-b ${branch}`}\` to read its reason; a branch checked out elsewhere takes --branch <name>.`,
    );
  }
}

function writeScope(inside: string, context: string): void {
  const file = path.join(inside, WORKER_SCOPE_FILE);

  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${JSON.stringify({ context }, null, 2)}\n`);
}

function todoSlices(root: string, context: string): Slice[] {
  return (readSlices(new Workspace(root, false)) ?? []).filter((row) => row.owner === context && row.status === 'todo');
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
