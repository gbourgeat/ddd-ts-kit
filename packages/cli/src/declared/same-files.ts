/** True when two sets of generated files hold the same paths with the same text. */
export function sameFiles(left: ReadonlyMap<string, string>, right: ReadonlyMap<string, string>): boolean {
  return left.size === right.size && [...left].every(([file, content]) => right.get(file) === content);
}
