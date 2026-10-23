import { BRACKETS } from './brackets';

/** Offset of the first `terminator` met outside any bracket from `from`, or of the bracket closing the block around it. */
export function endAtDepthZero(code: string, from: number, terminator: string): number {
  let depth = 0;

  for (let i = from; i < code.length; i += 1) {
    const char = code.charAt(i);

    if (BRACKETS.openers.includes(char)) {
      depth += 1;
    } else if (BRACKETS.closers.includes(char)) {
      depth -= 1;
    }

    if (depth < 0 || (depth === 0 && char === terminator)) {
      return i;
    }
  }

  return code.length;
}
