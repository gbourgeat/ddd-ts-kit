import type { ChainLink } from './chain-links';

/** What adds an alternative beside the conditions of a statement: `orWhere`, `orWhereIn`, the `or` modifier. `orHaving` applies after the where, and is free. */
const OR_METHOD = /^or(?:$|Where)/;

/** Whether a link of a builder chain adds an alternative at the top of its statement. */
export function isOrLink({ method }: ChainLink): boolean {
  return OR_METHOD.test(method);
}
