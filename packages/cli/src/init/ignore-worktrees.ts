import type { Workspace } from '../workspace';
import { WORKTREES_DIR } from '../worker/worktree-home';
import { mergedIgnoreLines } from './merged-ignore-lines';

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

  const merged = mergedIgnoreLines(text, `${WORKTREES_DIR}/\n`);

  // A rule of the team on .worktrees/ itself is the team's decision: nothing is added.
  if (merged === text) {
    return;
  }

  ws.update(GITIGNORE, merged);

  ws.note(
    `${GITIGNORE} now ignores ${WORKTREES_DIR}/, where the worktrees of the agents live: commit it on the trunk.`,
  );
}
