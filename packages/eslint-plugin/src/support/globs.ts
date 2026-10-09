const TRANSLATION: Readonly<Record<string, string>> = { '**/': '(?:.*/)?', '**': '.*', '*': '[^/]*', '?': '[^/]' };
const TOKEN = /\*\*\/|\*\*|\*|\?|[.+^${}()|[\]\\]/g;

/** A posix path matcher: `**` crosses directories, `*` stays inside one, `?` is one character, the rest is literal. */
export function globMatcher(globs: readonly string[]): (path: string) => boolean {
  const patterns = globs.map((glob) => new RegExp(`^${glob.replace(TOKEN, (token) => TRANSLATION[token] ?? `\\${token}`)}$`));
  return (path) => patterns.some((pattern) => pattern.test(path));
}
