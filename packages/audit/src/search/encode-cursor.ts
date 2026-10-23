import type { CursorPosition } from './cursor-position';

export function encodeCursor(last: CursorPosition): string {
  const position = [last.occurredAt.toISOString(), last.chain, last.sequence];

  return Buffer.from(JSON.stringify(position), 'utf8').toString('base64url');
}
