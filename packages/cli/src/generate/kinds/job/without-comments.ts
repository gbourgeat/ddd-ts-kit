/**
 * A source with its comments left out, for the readers of a constructor signature: block comments
 * and whole-line `//` comments only, so that text inside a string (`'https://...'`, `'a // b'`) stays.
 * A generated message describes its constructor in a `TODO(domain)` comment before it has one.
 */
export function withoutComments(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split('\n')
    .filter((line) => !line.trim().startsWith('//'))
    .join('\n');
}
