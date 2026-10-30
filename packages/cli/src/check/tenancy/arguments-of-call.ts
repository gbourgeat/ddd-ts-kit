import { endOfEnclosing } from './end-of-enclosing';

/** The arguments of a call that is the whole expression: `a, b` of `and(a, b)`, and `undefined` of `and(a).b`. */
export function argumentsOfCall(bare: string, callee: RegExp): string | undefined {
  const call = callee.exec(bare);

  if (call?.index !== 0) {
    return undefined;
  }

  const open = call[0].length;

  return endOfEnclosing(bare, open) === bare.length - 1 ? bare.slice(open, -1) : undefined;
}
