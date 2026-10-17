const WORKING = 'working-';

/**
 * The name a migration of the branch is generated again with: what follows its number. In the
 * worktree of a worker it stays a working migration; elsewhere (the conductor, a branch of its
 * own) it becomes the real one, without the `working-` prefix.
 */
export function replayedName(tag: string, inWorker: boolean): string {
  const at = tag.indexOf('_');
  const name = at === -1 ? tag : tag.slice(at + 1);

  return inWorker || !name.startsWith(WORKING) || name === WORKING ? name : name.slice(WORKING.length);
}
