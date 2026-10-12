/** The cases of one factory, under a `describe` of its name, one level deeper. */
export function nestedCases(factory: string, cases: string): string {
  const deeper = cases
    .split('\n')
    .map((line) => (line === '' ? line : `  ${line}`))
    .join('\n');

  return `  describe('${factory}', () => {\n${deeper}\n  });`;
}
