import { BRACKETS } from './brackets';

/** How many brackets are open at an offset, counted from the one at `from`. */
export function depthAt(code: string, from: number, offset: number): number {
  let depth = 0;

  for (let i = from; i < offset; i += 1) {
    const char = code.charAt(i);

    depth += BRACKETS.openers.includes(char) ? 1 : BRACKETS.closers.includes(char) ? -1 : 0;
  }

  return depth;
}
