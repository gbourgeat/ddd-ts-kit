import { runGit } from '../commit/run-git';
import type { History } from './history';
import { historyOf } from './history-of';

/**
 * What the change of the working tree removed under the source root since it left `since`:
 * the files deleted or renamed from the merge base to the working tree, uncommitted ones
 * included. Nothing when `since` names no commit. `since` is the commit a ref the caller checked
 * names, never the name itself, which may start with a dash.
 */
export function removalsSince(root: string, since: string, sourceRoot: string): History {
  const base = runGit(root, ['merge-base', '--end-of-options', since, 'HEAD'])?.trim();

  if (base === undefined) {
    return { removals: new Map(), added: new Map() };
  }

  const diff = runGit(root, ['diff', '--name-status', '-M', '--relative', base, '--', sourceRoot]);

  return historyOf(diff ?? '', base);
}
