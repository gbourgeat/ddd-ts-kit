import { BRACKETS } from '../text/brackets.js';
import { matchingBracket } from '../text/matching-bracket.js';
import type { FunctionBody } from './function-body.js';

/** What may stand before the arrow of an arrow function: its type parameters, its parameters and its return type. */
const PARAMETERS = /^(?:async\s*)?(?:<[\s\S]*>\s*)?(?:\([\s\S]*\)|[\w$]+)(?:\s*:[\s\S]*)?$/;

/** The body of the arrow function the expression at `from` is; undefined when the expression is not one. */
export function arrowBody(code: string, from: number): FunctionBody | undefined {
  const arrow = arrowAtDepthZero(code, from);

  if (arrow === undefined || !PARAMETERS.test(code.slice(from, arrow).trim())) {
    return undefined;
  }

  const start = arrow + 2 + (/^\s*/.exec(code.slice(arrow + 2))?.[0].length ?? 0);

  return code.charAt(start) === '{'
    ? { kind: 'block', open: start, close: matchingBracket(code, start) }
    : { kind: 'expression', start };
}

/** The first `=>` outside any bracket before the expression ends. */
function arrowAtDepthZero(code: string, from: number): number | undefined {
  let depth = 0;

  for (let i = from; i < code.length - 1 && depth >= 0; i += 1) {
    const char = code.charAt(i);

    if (depth === 0 && endsBefore(code, i)) {
      return char === '=' ? i : undefined;
    }

    depth += depthChange(char);
  }

  return undefined;
}

/** At depth zero: the arrow found, or the end of the expression without one. */
function endsBefore(code: string, at: number): boolean {
  const char = code.charAt(at);

  return (char === '=' && code.charAt(at + 1) === '>') || char === ';' || char === ',';
}

function depthChange(char: string): number {
  if (BRACKETS.openers.includes(char)) {
    return 1;
  }

  return BRACKETS.closers.includes(char) ? -1 : 0;
}
