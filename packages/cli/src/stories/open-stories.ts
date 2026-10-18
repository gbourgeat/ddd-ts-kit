import path from 'node:path';
import { storyOfRow } from '../acceptance/story-of-row.js';
import { readSlices } from '../progress/read-slices.js';
import { listWorktrees } from '../worker/list-worktrees.js';
import { Workspace } from '../workspace/index.js';
import type { OpenStory } from './open-story.js';
import { readStoryPlace } from './read-story-place.js';

/**
 * Each story open in a worktree of the repository, with the contexts its rows name in that
 * worktree: where two sessions are about to change the same contexts. `prefix` is the path of the
 * project inside its repository.
 */
export function openStories(root: string, prefix: string): OpenStory[] {
  return listWorktrees(root).flatMap((worktree) => {
    const inside = path.join(worktree.path, prefix);
    const place = readStoryPlace(inside);

    if (place === undefined) {
      return [];
    }

    const rows = (readSlices(new Workspace(inside, false)) ?? []).filter(
      (row) => storyOfRow(row.id).toLowerCase() === place.story.toLowerCase(),
    );

    return [
      {
        story: place.story,
        worktree: inside,
        ...(worktree.branch === undefined ? {} : { branch: worktree.branch }),
        contexts: [...new Set(rows.map((row) => row.context))].sort(),
      },
    ];
  });
}
