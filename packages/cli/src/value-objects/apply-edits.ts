import type { Edit } from './edit.js';

/** Applies edits that do not overlap, whatever their order. */
export function applyEdits(source: string, edits: readonly Edit[]): string {
  return [...edits]
    .sort((a, b) => b.start - a.start)
    .reduce((text, edit) => text.slice(0, edit.start) + edit.text + text.slice(edit.end), source);
}
