/**
 * What an alias specifier ends with under "importExtension": nothing for `none`, `.js` otherwise.
 * Mirrors `specifierSuffix` of the CLI: a wrong value is read as `js`.
 */
export function specifierSuffix(importExtension: string): '' | '.js' {
  return importExtension === 'none' ? '' : '.js';
}
