import type { CursorPosition } from './cursor-position.js';
import { InvalidPageRequestError } from './invalid-page-request-error.js';

/** The position a cursor stands for. A cursor this function did not write is refused. */
export function decodeCursor(cursor: string): CursorPosition {
  const position = parsedPosition(cursor);

  if (!isCursorPosition(position)) {
    throw new InvalidPageRequestError('The cursor of a page is the nextCursor of a previous page');
  }

  return position;
}

function parsedPosition(cursor: string): unknown {
  try {
    return JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8'));
  } catch {
    return undefined;
  }
}

function isCursorPosition(value: unknown): value is CursorPosition {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;

  return Object.values(value).every(
    (part) => part === null || ['string', 'number', 'boolean'].includes(typeof part),
  );
}
