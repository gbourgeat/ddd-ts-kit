const SUFFIX = '.acceptance.spec.ts';

/** The story an acceptance spec of `test/acceptance/` is named after, in lower case; undefined for another file. */
export function storyOfFile(name: string): string | undefined {
  return name.endsWith(SUFFIX) && !name.includes('/') ? name.slice(0, -SUFFIX.length) : undefined;
}
