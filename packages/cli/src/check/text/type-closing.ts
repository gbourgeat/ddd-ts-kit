import { typeBrackets } from './type-brackets';

/** Offset of the bracket or angle bracket closing the one at `open` in a type read as text, or -1. */
export function typeClosing(type: string, open: number): number {
  let depth = 0;

  for (let i = open; i < type.length; i += 1) {
    depth += typeBrackets(type.charAt(i), type.charAt(i - 1));

    if (depth === 0) {
      return i;
    }
  }

  return -1;
}
