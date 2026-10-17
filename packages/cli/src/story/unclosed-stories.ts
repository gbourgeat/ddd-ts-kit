import type { Remaining } from '../progress/remaining.js';
import type { Slice } from '../progress/slice.js';
import type { UnclosedStory } from '../progress/progress.js';
import { closingOf } from './closing-of.js';
import type { AttributedMarker } from './attributed-marker.js';
import { mayKeepOpen } from './may-keep-open.js';
import { storyOf } from './story-of.js';
import { storyScope } from './story-scope.js';

/** The rows, markers and contexts of the project, and how to tell whose markers are. */
interface Project {
  readonly rows: readonly Slice[];
  readonly remaining: readonly Remaining[];
  readonly contexts: readonly string[];
  readonly attribute: (markers: readonly Remaining[]) => AttributedMarker[];
}

/**
 * The stories and milestones whose rows are all done while markers of their own keep them open,
 * in the order of the file, as `story-check` judges them. Only the markers that may keep one of
 * them open are attributed: none when no story has all its rows done.
 */
export function unclosedStories({ rows, remaining, contexts, attribute }: Project): UnclosedStory[] {
  const stories = [...new Set(rows.map((row) => storyOf(row.id)))].filter(
    (story): story is string =>
      story !== undefined && rows.every((row) => storyOf(row.id) !== story || row.status === 'done'),
  );

  const scopes = stories.map((story) => storyScope(story, rows, contexts));
  const candidates = remaining.filter((marker) => scopes.some((scope) => mayKeepOpen(marker, scope)));
  const markers = candidates.length === 0 ? [] : attribute(candidates);

  return stories.flatMap((story): UnclosedStory[] => {
    const left = closingOf(story, { rows, markers, contexts }).markers.length;

    return left === 0 ? [] : [{ story, markers: left, command: `npx ddd-ts-kit story-check ${story}` }];
  });
}
