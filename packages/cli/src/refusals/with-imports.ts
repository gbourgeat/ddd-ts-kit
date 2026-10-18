/** A source with the import lines it lacks, after its last import. */
export function withImports(source: string, imports: readonly string[]): string {
  const missing = imports.filter((line) => !source.includes(line));
  const last = [...source.matchAll(/^import [^;]+;\n/gm)].at(-1);
  const at = last === undefined ? 0 : last.index + last[0].length;

  return source.slice(0, at) + missing.join('') + source.slice(at);
}
