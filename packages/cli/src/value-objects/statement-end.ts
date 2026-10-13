import { BRACKETS } from '../check/text/brackets.js';

/** Offset of the `;` ending the statement whose expression starts at `from`, brackets skipped; of the bracket closing around it when it has none. */
export function statementEnd(code: string, from: number): number {
  let depth = 0;

  for (let i = from; i < code.length; i += 1) {
    const char = code.charAt(i);

    if (BRACKETS.openers.includes(char)) {
      depth += 1;
    } else if (BRACKETS.closers.includes(char)) {
      depth -= 1;
    }

    if (depth < 0 || (depth === 0 && char === ';')) {
      return i;
    }
  }

  return code.length;
}
