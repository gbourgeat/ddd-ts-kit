/** The glob pattern matching every key that starts with the prefix, whatever it contains. */
export function prefixPattern(prefix: string): string {
  return `${prefix.replaceAll(/[\\*?[\]]/g, '\\$&')}*`;
}
