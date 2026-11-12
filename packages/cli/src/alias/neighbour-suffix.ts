/**
 * What the relative path of a file of `test/support/` to its neighbour ends with under
 * "importExtension": nothing for `none`, the `.ts` of the source otherwise. A test runner loads its
 * global setup, and what that file imports, from the sources and before any alias exists: a `.js`
 * names a file that is not there.
 */
export function neighbourSuffix(importExtension: string): '' | '.ts' {
  return importExtension === 'none' ? '' : '.ts';
}
