import { signatureAt } from '../structure/signature-at';
import { matchingBracket } from '../text/matching-bracket';

/** A stretch of code between two braces. */
export type Span = readonly [open: number, close: number];

const ARROW = /=>\s*\{/g;
const FUNCTION = /(?<![\w$.])function\b[\s*]*(?:[\w$]+)?\s*(?:<[^()]*>)?\s*\(/g;
const METHOD = /(?<![\w$.])([A-Za-z_$][\w$]*)\s*(?:<[^()]*>)?\s*\(/g;

/** Words a parenthesis follows without starting a method: `if (..) {` is a block, not a body. */
const KEYWORDS = new Set(['if', 'for', 'while', 'switch', 'catch', 'with', 'return', 'function', 'typeof', 'await']);

/**
 * The bodies of the functions written between `from` and `to`: block arrows, function
 * expressions and declarations, and methods of the object literals and classes found there.
 */
export function nestedBodies(code: string, from: number, to: number): Span[] {
  const within = (index: number): boolean => index > from && index < to;

  const arrows = [...code.matchAll(ARROW)]
    .filter(({ index }) => within(index))
    .map(({ index, 0: arrow }): Span => {
      const open = index + arrow.length - 1;

      return [open, matchingBracket(code, open)];
    });

  const functions = [...code.matchAll(FUNCTION), ...code.matchAll(METHOD)]
    .filter((match) => within(match.index) && !KEYWORDS.has(match[1] ?? ''))
    .flatMap((match): Span[] => {
      const signature = signatureAt(code, match.index + match[0].length - 1);

      return signature === undefined ? [] : [[signature.bodyOpen, signature.bodyClose]];
    });

  return [...arrows, ...functions];
}
