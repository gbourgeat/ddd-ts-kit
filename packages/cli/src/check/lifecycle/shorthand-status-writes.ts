import type { SourceFile } from '../model/source-file';
import { BRACKETS } from '../text/brackets';

const SHORTHAND = /(?<![\w$.'"])status\s*(?=[,}])/g;
const DECLARED_BEFORE = /\b(?:const|let|var)\s*$/;

/**
 * The offsets of `status` written as a shorthand property of an object literal, `{ ...this.state,
 * status }`, leaving out a destructuring, `const { status } = this.state`, which reads it.
 */
export function shorthandStatusWrites(file: SourceFile): number[] {
  const { code } = file.scan;

  return [...code.matchAll(SHORTHAND)]
    .map(({ index }) => index)
    .filter((index) => {
      const opening = enclosingBrace(code, index);

      return opening !== -1 && !DECLARED_BEFORE.test(code.slice(Math.max(0, opening - 16), opening));
    });
}

/** The `{` of the object the offset is in, at its depth; -1 when it is in none. */
function enclosingBrace(code: string, from: number): number {
  let depth = 0;

  for (let i = from - 1; i >= 0; i -= 1) {
    const char = code.charAt(i);

    if (BRACKETS.closers.includes(char)) {
      depth += 1;
    } else if (BRACKETS.openers.includes(char)) {
      if (depth === 0) {
        return char === '{' ? i : -1;
      }

      depth -= 1;
    }
  }

  return -1;
}
