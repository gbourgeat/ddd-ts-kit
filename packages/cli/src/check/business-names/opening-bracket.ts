import { BRACKETS } from '../text/brackets';

/** Offset of the bracket opening the one that closes at `close`, read backwards, or -1. */
export function openingBracket(code: string, close: number): number {
  let depth = 0;

  for (let i = close; i >= 0; i -= 1) {
    const char = code.charAt(i);

    if (BRACKETS.closers.includes(char)) {
      depth += 1;
    } else if (BRACKETS.openers.includes(char) && (depth -= 1) === 0) {
      return i;
    }
  }

  return -1;
}
