/** A security requirement: every named scheme, with no scope. */
export function requirement(schemes: readonly string[]): Record<string, string[]>[] {
  return schemes.map((scheme) => ({ [scheme]: [] }));
}
