import type { CursorPosition } from './cursor-position';
import { cursorPositionOf } from './cursor-position-of';
import { InvalidPageRequestError } from './invalid-page-request-error';

/** The position a cursor stands for. A cursor this function did not write is refused. */
export function decodeCursor(cursor: string): CursorPosition {
  const position = cursorPositionOf(cursor);

  if (position === undefined) {
    throw new InvalidPageRequestError('The cursor of a page is the nextCursor of a previous page');
  }

  return position;
}
