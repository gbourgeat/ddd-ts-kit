import { mentionedRows } from '../citations/mentioned-rows';
import type { Remaining } from '../progress/remaining';
import type { StoryScope } from './story-scope';

/**
 * True for a marker that may keep the story open, before git says whose it is: in a context of
 * its rows, naming one of its rows, or outside the contexts when a row of it names none (`all`,
 * `platform`). Only those are blamed.
 */
export function mayKeepOpen(marker: Remaining, scope: StoryScope): boolean {
  return (
    scope.contexts.includes(marker.context) ||
    mentionedRows(marker.text, scope.ids).length > 0 ||
    (scope.unread.length > 0 && marker.context === '')
  );
}
