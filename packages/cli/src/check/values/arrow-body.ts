import { BRACKETS } from '../text/brackets';
import { matchingBracket } from '../text/matching-bracket';
import type { FunctionBody } from './function-body';

/** What may stand before the arrow of an arrow function: its type parameters, its parameters and its return type. */
const PARAMETERS = /^(?:async\s*)?(?:<[\s\S]*>\s*)?(?:\([\s\S]*\)|[\w$]+)(?:\s*:[\s\S]*)?$/;

/** The body of the arrow function the expression at `from` is; undefined when the expression is not one. */
export function arrowBody(code: string, from: number): FunctionBody | undefined {
  const arrow = arrowAtDepthZero(code, afterTypeParameters(code, from));

  if (arrow === undefined || !PARAMETERS.test(code.slice(from, arrow).trim())) {
    return undefined;
  }

  const start = arrow + 2 + (/^\s*/.exec(code.slice(arrow + 2))?.[0].length ?? 0);

  return code.charAt(start) === '{'
    ? { kind: 'block', open: start, close: matchingBracket(code, start) }
    : { kind: 'expression', start };
}

/** Past the type parameters an arrow may open with, `<T,>` included, whose commas do not end the expression. */
function afterTypeParameters(code: string, from: number): number {
  const start = from + (/^(?:async\s*)?/.exec(code.slice(from))?.[0].length ?? 0);
  let angles = 0;

  for (let i = start; code.charAt(start) === '<' && i < code.length; i += 1) {
    angles += code.charAt(i) === '<' ? 1 : 0;
    angles -= code.charAt(i) === '>' && code.charAt(i - 1) !== '=' ? 1 : 0;

    if (angles === 0) {
      return i + 1;
    }
  }

  return from;
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
