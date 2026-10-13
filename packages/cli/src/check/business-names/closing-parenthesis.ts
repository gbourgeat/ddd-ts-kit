import { BRACKETS } from '../text/brackets.js';

/** Offset of the `)` that closes a parenthesis opened before `from`, or the end of the text. */
export function closingParenthesis(text: string, from: number): number {
  let depth = 0;

  for (let i = from; i < text.length; i += 1) {
    const char = text.charAt(i);

    if (BRACKETS.openers.includes(char)) {
      depth += 1;
    } else if (BRACKETS.closers.includes(char) && (depth -= 1) < 0) {
      return i;
    }
  }

  return text.length;
}
