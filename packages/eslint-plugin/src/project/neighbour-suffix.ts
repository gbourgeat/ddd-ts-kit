/**
 * What the relative path of a file of `test/support/` to its neighbour ends with under
 * "importExtension": nothing for `none`, the `.ts` of the source otherwise. Mirrors
 * `neighbourSuffix` of the CLI.
 */
export function neighbourSuffix(importExtension: string): '' | '.ts' {
  return importExtension === 'none' ? '' : '.ts';
}
