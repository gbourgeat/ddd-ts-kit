import { BRACKETS } from './brackets.js';

/** Offset of the bracket closing the one at `open`, or the end of the text. */
export function matchingBracket(code: string, open: number): number {
  let depth = 0;

  for (let i = open; i < code.length; i += 1) {
    const char = code.charAt(i);

    if (BRACKETS.openers.includes(char)) depth += 1;
    else if (BRACKETS.closers.includes(char) && (depth -= 1) === 0) return i;
  }

  return code.length - 1;
}
