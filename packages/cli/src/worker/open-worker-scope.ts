import fs from 'node:fs';
import path from 'node:path';
import { staleNamesAt } from '../citations/stale-names-at.js';
import { CliError } from '../cli-error.js';
import { runGit } from '../commit/run-git.js';
import { WORKER_SCOPE_FILE } from '../commit/worker-scope-file.js';
import type { Config } from '../config/index.js';
import { KINDS } from '../generate/kinds.js';
import { inDialect } from '../package-manager/in-dialect.js';
import { readStoryPlace } from '../stories/read-story-place.js';
import { STORY_SCOPE_FILE } from '../stories/story-scope-file.js';
import { Workspace } from '../workspace/index.js';
import { addWorktree } from './add-worktree.js';
import { branchExists } from './branch-exists.js';
import { briefedRows } from './briefed-rows.js';
import { briefingOf } from './briefing-of.js';
import { designNote } from './design-note.js';
import { ensureContainsBase } from './ensure-contains-base.js';
import { type DependencyInstall, installDependencies } from './install-dependencies.js';
import { isWorktree } from './is-worktree.js';
import { baseOf } from './base-of.js';
import { repositoryPrefix } from './repository-prefix.js';
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
  /** Whether a worktree this run creates gets its dependencies installed (`--no-install` says no). */
  readonly install: boolean;
  /**
   * In the worktree of a story: the worker builds there, one agent after the other, its scope
   * written in place, its base the base of the story; no worktree, branch or install of its own.
   */
  readonly here?: boolean;
}

/**
 * Gives one worker its place: a git worktree of the project on its own branch, cut from the
 * base, with its dependencies installed, the file that confines it to its context, and its
 * briefing. An existing worktree or branch is kept when it contains the base: only the file is
 * written again.
 */
export function openWorkerScope(root: string, config: Config, request: WorkerRequest): WorkerScope {
  const { context, dryRun } = request;
  const { project, worktree, branch, trunk, created, inside } = placeOf(root, config, request);
  const { slices, notes } = briefedRows(new Workspace(root, false), context, request.rows);
  const manager = config.stack.packageManager;
  const citations = staleNamesAt(root, config, { ref: trunk, rows: slices.map((row) => row.id) });

  const rows = slices.map((row) => row.id);
  const install = prepareWorktree(root, request, { worktree, branch, trunk, created, inside, rows, manager });
  const generators = workerGenerators(KINDS);
  const briefing = briefingOf({ config, context, project, root: inside, branch, trunk, generators, slices, citations });

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
    citations,
    briefing,
    notes: [
      ...notes,
      ...designNote(citations),
      ...citations.notes,
      ...notesOf(root, dryRun ? root : inside, { manager, install }),
    ],
  };
}

/** The place of a worker as `prepareWorktree` needs it. */
interface PreparedPlace {
  readonly worktree: string;
  readonly branch: string;
  readonly trunk: string;
  readonly created: boolean;
  readonly inside: string;
  readonly rows: readonly string[];
  readonly manager: Config['stack']['packageManager'];
}

/**
 * Outside a dry run: the worktree it creates, the file that confines the worker, then the clean
 * install of a worktree it created, unless refused; answers that install, if it made one.
 */
function prepareWorktree(root: string, request: WorkerRequest, place: PreparedPlace): DependencyInstall | undefined {
  const { worktree, branch, trunk, created, inside, rows, manager } = place;

  if (request.dryRun) {
    return undefined;
  }

  if (created) {
    addWorktree(root, { worktree, branch, base: trunk });
  }

  writeScope(root, inside, { context: request.context, rows: [...rows], base: trunk, branch });

  return created && request.install ? installDependencies(inside, manager) : undefined;
}

/** What the worktree got of its dependencies: the install this run made, if it made one. */
interface Dependencies {
  readonly manager: Config['stack']['packageManager'];
  readonly install: DependencyInstall | undefined;
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
  if (request.here === true) {
    return herePlace(root, request);
  }

  const prefix = repositoryPrefix(root);
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

/** The worktree of the story itself, on its branch, the base of the story as the base of the worker. */
function herePlace(root: string, request: WorkerRequest): Place {
  const story = readStoryPlace(root);

  if (story === undefined) {
    throw new CliError(
      `--here briefs a worker inside the worktree of a story, and ${root} holds no ${STORY_SCOPE_FILE}.`,
      'Open the story first (`npx ddd-ts-kit story-scope <story>`), then run worker-scope --here from its worktree; elsewhere a worker gets its own worktree.',
    );
  }

  return {
    project: path.basename(root),
    worktree: root,
    branch: runGit(root, ['branch', '--show-current'])?.trim() || story.branch,
    trunk: request.base ?? story.base,
    created: false,
    inside: root,
  };
}

/**
 * The guard of the plugin reads `context`; `status --workers` shows the rest. The commit the base
 * names now is recorded next to it: the base is a moving name, the commit tells later where the
 * branch started.
 */
function writeScope(root: string, inside: string, scope: WorkerFile & { readonly base: string }): void {
  const file = path.join(inside, WORKER_SCOPE_FILE);
  const baseCommit = runGit(root, ['rev-parse', '--verify', '--quiet', `${scope.base}^{commit}`])?.trim();
  const { branch, ...recorded } = scope;

  const written: WorkerFile = {
    ...recorded,
    ...(baseCommit === undefined ? {} : { baseCommit }),
    ...(branch === undefined ? {} : { branch }),
  };

  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${JSON.stringify(written, null, 2)}\n`);
}

function notesOf(root: string, inside: string, dependencies: Dependencies): string[] {
  const ignored = runGit(inside, ['check-ignore', '--quiet', WORKER_SCOPE_FILE]) !== undefined;

  return [
    ...(ignored
      ? []
      : [
          `${WORKER_SCOPE_FILE} is not ignored: add \`.ddd-ts-kit/\` to .gitignore on the trunk, so that no worker commits its scope.`,
        ]),
    ...dependencyNotes(root, inside, dependencies),
  ];
}

/** The time a passing install took; for a failed or skipped one, what to run before the worker starts. */
function dependencyNotes(root: string, inside: string, { manager, install }: Dependencies): string[] {
  if (install?.ok === true) {
    return [`dependencies installed in the worktree with \`${install.command}\` (${install.seconds} s).`];
  }

  if (inside === root || (install === undefined && fs.existsSync(path.join(inside, 'node_modules')))) {
    return [];
  }

  const failed = install === undefined ? '' : `\`${install.command}\` failed in the worktree (${install.seconds} s). `;
  const run = `Install the dependencies in the worktree before the worker starts: \`cd ${inside} && ${inDialect('npm ci', manager)}\`.`;
  const output = install === undefined ? [] : install.output.split('\n').map((line) => `  ${line}`);

  return [[`${failed}${run}`, ...output].join('\n')];
}
