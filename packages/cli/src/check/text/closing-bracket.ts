import { BRACKETS } from './brackets';

/**
 * Offset of the bracket that closes the one at `open`, in code whose comments and strings are
 * blanked; undefined when it is never closed, or when another kind of bracket closes first.
 */
export function closingBracket(code: string, open: number): number | undefined {
  const waiting: number[] = [];

  for (let at = open; at < code.length; at += 1) {
    const char = code.charAt(at);
    const opener = BRACKETS.openers.indexOf(char);
    const closer = BRACKETS.closers.indexOf(char);

    if (opener !== -1) {
      waiting.push(opener);
    } else if (closer !== -1 && waiting.pop() !== closer) {
      return undefined;
    } else if (closer !== -1 && waiting.length === 0) {
      return at;
    }
  }

  return undefined;
}
