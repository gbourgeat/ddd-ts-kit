import { endAtDepthZero } from './end-at-depth-zero.js';

/** The first argument of the call whose arguments start at `open`. */
export function firstArgument(code: string, open: number): string {
  return code.slice(open, endAtDepthZero(code, open, ','));
}
