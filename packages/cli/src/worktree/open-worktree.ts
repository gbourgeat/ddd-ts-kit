import path from 'node:path';
import { CliError } from '../cli-error';
import { runGit } from '../commit/run-git';
import type { Config } from '../config';
import { addWorktree } from '../worker/add-worktree';
import { baseOf } from '../worker/base-of';
import { ensureContainsBase } from '../worker/ensure-contains-base';
import { type DependencyInstall, installDependencies } from '../worker/install-dependencies';
import { installNotes } from '../worker/install-notes';
import { isWorktree } from '../worker/is-worktree';
import { repositoryPrefix } from '../worker/repository-prefix';
import { upstreamOf } from '../worker/upstream-of';
import { worktreeOf } from '../worker/worktree-of';
import type { WorktreeScope } from './worktree-scope';

/** What the caller asks: a name, and how to cut and prepare its worktree. */
export interface WorktreeRequest {
  readonly name: string;
  /** By default `work/<name>`. */
  readonly branch?: string;
  /** By default the branch the current one follows (`origin/main` for `main`), else the current one. */
  readonly base?: string;
  readonly dryRun: boolean;
  readonly install: boolean;
}

const NAME = /^[a-z0-9][a-z0-9._-]*$/i;

/**
 * The worktree of one piece of work that is neither a story nor the worker of a plan:
 * `.worktrees/<name>` in the project of the main checkout (next to the project while its
 * .gitignore does not hold `.worktrees/`), on `work/<name>` cut from the base,
 * with the clean install of its package manager. An existing one is kept: the work resumes there.
 */
export function openWorktree(root: string, config: Config, request: WorktreeRequest): WorktreeScope {
  const name = nameOf(request.name);
  const prefix = repositoryPrefix(root);
  const base = baseOf(root, config, request.base ?? upstreamOf(root));
  const { worktree, note } = worktreeOf(root, undefined, name);
  const branch = request.branch ?? `work/${name}`;
  const inside = path.join(worktree, prefix);
  const created = !isWorktree(root, worktree);

  if (!created) {
    ensureContainsBase(worktree, runGit(worktree, ['branch', '--show-current'])?.trim() || 'HEAD', base);
  }

  const install =
    created && !request.dryRun ? prepare(root, config, { worktree, inside, branch, base, request }) : undefined;

  return {
    name,
    dryRun: request.dryRun,
    worktree: inside,
    branch,
    base,
    created,
    ...(install === undefined ? {} : { install }),
    notes: [...(note === undefined ? [] : [note]), ...notesAfter(request, { inside, config, install })],
  };
}

/** The worktree it creates, then its clean install unless refused. */
function prepare(
  root: string,
  config: Config,
  place: { worktree: string; inside: string; branch: string; base: string; request: WorktreeRequest },
): DependencyInstall | undefined {
  addWorktree(root, place);

  return place.request.install ? installDependencies(place.inside, config.stack.packageManager) : undefined;
}

function nameOf(name: string): string {
  if (!NAME.test(name)) {
    throw new CliError(
      `"${name}" cannot name a worktree.`,
      'Name the work in a few letters, digits, dots or dashes: `npx ddd-ts-kit worktree invoice-totals`.',
    );
  }

  return name;
}

function notesAfter(
  request: WorktreeRequest,
  { inside, config, install }: { inside: string; config: Config; install: DependencyInstall | undefined },
): string[] {
  return request.dryRun ? [] : installNotes(inside, config, install);
}
