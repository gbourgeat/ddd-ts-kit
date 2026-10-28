import fs from 'node:fs';
import path from 'node:path';
import { runGit } from '../commit/run-git';
import { ensureIgnored } from './ensure-ignored';
import { askedWorktree } from './asked-worktree';
import { WORKTREES_DIR, worktreeHome } from './worktree-home';

/** Where a command opens or finds a worktree, and what to say when it is not where it should be. */
export interface WorktreePlace {
  readonly worktree: string;
  readonly note?: string;
}

/**
 * The worktree a command opens or finds again: the path asked (relative to the project root, but one under `.worktrees/` is
 * relative to the main checkout, so that it lands in the same place from any worktree), or
 * else `.worktrees/<name>`. A project whose .gitignore does not hold `.worktrees/` yet (one
 * started before) gets its new worktree next to it, `../<project>-<name>`, with a note; a path
 * asked under `.worktrees/` that git does not ignore is refused.
 */
export function worktreeOf(root: string, asked: string | undefined, name: string): WorktreePlace {
  if (asked !== undefined) {
    const worktree = askedWorktree(root, asked);

    if (path.basename(path.dirname(worktree)) === WORKTREES_DIR && !fs.existsSync(worktree)) {
      ensureIgnored(worktree);
    }

    return path.resolve(root, asked) === worktree
      ? { worktree }
      : { worktree, note: `${asked} is under ${WORKTREES_DIR}/, so it is the one of the main checkout: ${worktree}.` };
  }

  const home = worktreeHome(root, name);
  const project = path.dirname(path.dirname(home));

  if (fs.existsSync(home) || runGit(project, ['check-ignore', '--quiet', path.relative(project, home)]) !== undefined) {
    return { worktree: home };
  }

  return {
    worktree: path.join(path.dirname(project), `${path.basename(project)}-${name}`),
    note: `${WORKTREES_DIR}/ is not ignored by git yet: the worktree is opened next to the project. Run \`npx ddd-ts-kit init\` (it adds ${WORKTREES_DIR}/ to .gitignore), commit it, and the next ones go under ${WORKTREES_DIR}/.`,
  };
}
