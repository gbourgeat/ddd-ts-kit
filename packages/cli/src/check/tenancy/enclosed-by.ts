import { endOfEnclosing } from './end-of-enclosing';

/** What a bracket encloses when it holds the whole expression: `a, b` of `[a, b]`, and `undefined` of `[a].concat(b)`. */
export function enclosedBy(bare: string, opening: '[' | '{'): string | undefined {
  return bare.startsWith(opening) && endOfEnclosing(bare, 1) === bare.length - 1 ? bare.slice(1, -1) : undefined;
}
