/** True when `directory` has the shape of `pattern`, whose `*` stands for one level. */
export function matchesDirectory(pattern: string, directory: string): boolean {
  const expected = pattern.split('/');
  const actual = directory.split('/');

  return expected.length === actual.length && expected.every((part, index) => part === '*' || part === actual[index]);
}
