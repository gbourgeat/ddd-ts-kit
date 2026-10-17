/** The paths that are new or changed between two readings of a migrations folder, in order. */
export function writtenPaths(before: ReadonlyMap<string, string>, after: ReadonlyMap<string, string>): string[] {
  return [...after.entries()].filter(([file, content]) => before.get(file) !== content).map(([file]) => file);
}
