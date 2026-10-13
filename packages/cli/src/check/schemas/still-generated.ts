import type { SourceFile } from '../model/source-file.js';

/** The mark the generator leaves where a developer is expected to write: `TODO(domain)` and its kind. */
const LEFT_TO_WRITE = /\bTODO\([a-z-]+\)/;

/**
 * Whether the text between two offsets still carries a mark of the generator: a shape that does
 * is a placeholder waiting for its fields (every search line starts as `{ id }`), not a shape
 * someone declared, so two of them are not a copy.
 */
export function stillGenerated(file: SourceFile, start: number, end: number): boolean {
  return LEFT_TO_WRITE.test(file.text.slice(start, end));
}
