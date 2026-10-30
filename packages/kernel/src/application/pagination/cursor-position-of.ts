import type { CursorPosition } from './cursor-position';

/** The position a cursor stands for, or `undefined` for a cursor `encodeCursor` did not write. */
export function cursorPositionOf(cursor: string): CursorPosition | undefined {
  const position = parsedPosition(cursor);

  return isCursorPosition(position) ? position : undefined;
}

function parsedPosition(cursor: string): unknown {
  try {
    return JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8'));
  } catch {
    return undefined;
  }
}

function isCursorPosition(value: unknown): value is CursorPosition {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return false;
  }

  return Object.values(value).every((part) => part === null || ['string', 'number', 'boolean'].includes(typeof part));
}
