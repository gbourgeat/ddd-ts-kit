import { matchingBracket } from '../check/text/matching-bracket.js';
import { splitTopLevel } from '../check/text/split-top-level.js';

const NAMED = /^(?:\.\.\.)?([A-Za-z_$][\w$]*)/;

/**
 * The name of the first parameter of the list opened at `open` in `code`: undefined when the list
 * is empty or the first parameter is destructured, since no single name then says what it is.
 */
export function firstParameter(code: string, open: number): string | undefined {
  const [first] = splitTopLevel(code.slice(open + 1, matchingBracket(code, open)));

  return first === undefined ? undefined : NAMED.exec(first.code)?.[1];
}
