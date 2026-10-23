import type { StoryKind } from './story-kind.js';

/**
 * What `.ddd-ts-kit/story.json` holds in the worktree of a story: the story one session takes from
 * its questions to its pull request, and where its branch started. Local, never committed.
 */
export interface StoryPlace {
  /** The code of the story, as its rows start in slices.md: `US5`. */
  readonly story: string;
  /** The ref the branch was cut from and merges back into. */
  readonly base: string;
  /** The commit the base named when the worktree was opened. */
  readonly baseCommit?: string;
  readonly branch: string;
  /** `story` unless opened with `--kind fix`; a file written before the key is a `story`. */
  readonly kind: StoryKind;
  /** Where the story comes from, relative to the project root: an accepted intent or an incident record, as `--from` gave it. */
  readonly from?: string;
}
