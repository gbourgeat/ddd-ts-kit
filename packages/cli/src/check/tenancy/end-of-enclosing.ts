import { BRACKET_DEPTH } from './bracket-depth';

/**
 * Where what encloses `from` ends: the offset of the bracket that closes it, or of the first of
 * `stops` outside any bracket, or the end of the code. A local lives up to the first (`}` of its
 * block), an expression up to the second (the `,` or `;` after it).
 */
export function endOfEnclosing(code: string, from: number, stops = ''): number {
  let depth = 0;

  for (let index = from; index < code.length; index += 1) {
    const char = code.charAt(index);

    depth += BRACKET_DEPTH[char] ?? 0;

    if (depth < 0 || (depth === 0 && stops.includes(char))) {
      return index;
    }
  }

  return code.length;
}
