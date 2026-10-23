import type { Workspace } from '../workspace';
import { WORKTREES_DIR } from '../worker/worktree-home';

const GITIGNORE = '.gitignore';

/**
 * Adds `.worktrees/` to the .gitignore of a project initialised before the worktrees moved there:
 * a worktree under it would otherwise be committed as an embedded repository.
 */
export function ignoreWorktrees(ws: Workspace): void {
  const text = ws.read(GITIGNORE);

  if (text === undefined || text.split('\n').some((line) => /^\/?\.worktrees\/?$/.test(line.trim()))) {
    return;
  }

  ws.update(GITIGNORE, `${text}${text.endsWith('\n') || text === '' ? '' : '\n'}${WORKTREES_DIR}/\n`);

  ws.note(
    `${GITIGNORE} now ignores ${WORKTREES_DIR}/, where the worktrees of the agents live: commit it on the trunk.`,
  );
}
