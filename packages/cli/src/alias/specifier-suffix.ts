/**
 * What an alias specifier ends with under "importExtension": nothing for `none`, `.js` otherwise.
 * A value `check` reports as wrong is read as `js`, which is what a config without the key means.
 */
export function specifierSuffix(importExtension: string): '' | '.js' {
  return importExtension === 'none' ? '' : '.js';
}
