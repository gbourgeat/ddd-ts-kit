import type { ChainLink } from './chain-links';

/** What adds an alternative beside the conditions of a statement: `orWhere`, `orWhereIn`, `orHaving`, the `or` modifier. */
const OR_METHOD = /^or(?:$|Where|Having)/;

/** Whether a link of a builder chain adds an alternative at the top of its statement. */
export function isOrLink({ method }: ChainLink): boolean {
  return OR_METHOD.test(method);
}
