import type { FunctionBody } from './function-body.js';
import { literalAt } from './literal-at.js';
import { nestedBodies } from './nested-bodies.js';

const RETURN = /(?<![\w$.])return\b/g;

/**
 * The object literals a function answers by itself, as the offsets of their `{`: the expression
 * of an arrow, or what a `return` of its own block gives back. A `return` of a function nested
 * in it answers for that function, not for this one.
 */
export function answeredLiterals(code: string, body: FunctionBody): number[] {
  if (body.kind === 'expression') {
    const literal = literalAt(code, body.start);

    return literal === undefined ? [] : [literal];
  }

  const nested = nestedBodies(code, body.open, body.close);
  const own = (index: number): boolean => !nested.some(([open, close]) => index > open && index < close);

  return [...code.matchAll(RETURN)]
    .filter(({ index }) => index > body.open && index < body.close && own(index))
    .flatMap(({ index, 0: keyword }) => literalAt(code, index + keyword.length) ?? []);
}
