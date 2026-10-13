import { matchingBracket } from '../text/matching-bracket.js';
import { splitTopLevel } from '../text/split-top-level.js';

/** `name(..) {`, `get name() {`, `async name(..) {`: a method of the literal. */
const METHOD = /^(?:async\s+)?(?:get\s+|set\s+)?\*?\s*[\w$]+\s*(?:<[^()]*>)?\s*\(/;

/** `name: (..) => ..`, `name: x => ..`, `name: function (..) {`: a function held by a property. */
const FUNCTION_PROPERTY =
  /^[\w$'"]+\s*:\s*(?:async\s+)?(?:function\b|(?:<[^()]*>\s*)?(?:\([\s\S]*?\)|[\w$]+)\s*(?::[^=]*?)?=>)/;

/**
 * Whether the object literal opening at `open` holds data: one entry at least that is not a
 * function. An object of functions only is behaviour (a specification, a strategy), not a value.
 */
export function standsForAValue(code: string, open: number): boolean {
  const entries = splitTopLevel(code.slice(open + 1, matchingBracket(code, open)));

  return entries.some(({ code: entry }) => !METHOD.test(entry) && !FUNCTION_PROPERTY.test(entry));
}
