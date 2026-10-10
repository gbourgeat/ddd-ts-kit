import { matchingBracket } from './matching-bracket.js';
import type { ListPart } from './list-part.js';
import { splitTopLevel } from './split-top-level.js';

/** The arguments of the call whose opening parenthesis is at `open`, each with its offset in `code`. */
export function callArguments(code: string, open: number): ListPart[] {
  const close = matchingBracket(code, open);

  return splitTopLevel(code.slice(open + 1, close)).map((part) => ({ code: part.code, start: open + 1 + part.start }));
}
