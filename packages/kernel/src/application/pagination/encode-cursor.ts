import type { CursorPosition } from './cursor-position.js';

/**
 * The opaque `nextCursor` of a position. Opaque means that a client sends it back untouched;
 * it is not a secret and not signed, so the reader validates what `decodeCursor` gives.
 */
export function encodeCursor(position: CursorPosition): string {
  return Buffer.from(JSON.stringify(position), 'utf8').toString('base64url');
}
