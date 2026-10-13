/** The words of a PascalCase or kebab-case name, in lower case. */
export function wordsOf(name: string): string[] {
  return name
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .split(/[\s\-_.]+/)
    .filter((word) => word !== '')
    .map((word) => word.toLowerCase());
}
