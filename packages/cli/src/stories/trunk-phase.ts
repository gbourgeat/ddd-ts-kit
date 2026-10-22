import { runGit } from '../commit/run-git';
import type { Workspace } from '../workspace';
import { readStoryPlace } from './read-story-place';
import type { StoryPhase } from './story-phase';

/**
 * Its base merged into its branch, as this repository knows the base: the pull request is read
 * against it. Read in the worktree of the story only; from another checkout it is not held.
 */
export function trunkPhase(ws: Workspace, story: string): StoryPhase {
  const place = readStoryPlace(ws.root);
  const own = place !== undefined && place.story.toLowerCase() === story.toLowerCase();
  const behind = own ? runGit(ws.root, ['rev-list', '--count', `HEAD..${place.base}`])?.trim() : undefined;
  const base = place?.base ?? '<base>';

  return {
    id: 'trunk',
    title: 'trunk merged in',
    met: !own || behind === '0',
    detail: !own
      ? 'read in the worktree of the story'
      : behind === undefined
        ? `${base} names no commit`
        : behind === '0'
          ? `${base} merged in`
          : `${behind} commit(s) of ${base} not merged in`,
    next: `Bring the trunk in: commit, then \`npx ddd-ts-kit merge-trunk --trunk ${base}\` (\`git fetch\` first when the base is remote), and run the checks again.`,
    gate: 'close',
  };
}
