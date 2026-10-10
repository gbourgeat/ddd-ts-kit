import { endAtDepthZero } from './end-at-depth-zero.js';

/** Offset of the `;` ending the statement that holds `from`, or of the bracket closing the block around it. */
export function statementEnd(code: string, from: number): number {
  return endAtDepthZero(code, from, ';');
}
