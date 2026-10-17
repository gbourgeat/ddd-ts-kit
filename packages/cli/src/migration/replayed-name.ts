const WORKING = 'working-';

/**
 * The name a migration of the branch is generated again with: what follows its number. Kept a
 * working migration when `keepWorking` (the worktree of a worker, before its branch lands);
 * otherwise (the conductor, a branch of its own, the replay that lands the branch) it becomes the
 * real one, without the `working-` prefix.
 */
export function replayedName(tag: string, keepWorking: boolean): string {
  const at = tag.indexOf('_');
  const name = at === -1 ? tag : tag.slice(at + 1);

  return keepWorking || !name.startsWith(WORKING) || name === WORKING ? name : name.slice(WORKING.length);
}
