import type { Slice } from '../progress/slice';
import { storyOf } from './story-of';

/** A story or a milestone as its rows draw it. */
export interface StoryScope {
  readonly story: string;
  /** The ids of its rows, in the order of the slices file. */
  readonly ids: readonly string[];
  /** The contexts of the project its rows belong to. */
  readonly contexts: readonly string[];
  /** The Context cells of its rows that name no context of the project (`all`, `platform`). */
  readonly unread: readonly string[];
}

/** The rows of a story and the contexts they belong to, among the contexts of the project. */
export function storyScope(story: string, rows: readonly Slice[], contexts: readonly string[]): StoryScope {
  const own = rows.filter((row) => storyOf(row.id) === story);
  const cells = [...new Set(own.map((row) => row.context))];
  const known = cells.filter((cell) => contexts.includes(cell)).sort();

  return {
    story,
    ids: [...new Set(own.map((row) => row.id))],
    contexts: known,
    unread: cells.filter((cell) => !known.includes(cell)),
  };
}
