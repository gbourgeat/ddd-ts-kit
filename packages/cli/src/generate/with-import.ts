const IMPORT = /^import\s[^;]*;[ \t]*$/gm;

/** The source with an import line after its last import, unless it already holds that line. */
export function withImport(source: string, line: string): string {
  if (source.includes(line)) {
    return source;
  }

  const last = [...source.matchAll(IMPORT)].at(-1);
  const end = last === undefined ? 0 : last.index + last[0].length;
  const separator = end === 0 ? '' : '\n';

  return `${source.slice(0, end)}${separator}${line}${end === 0 ? '\n' : ''}${source.slice(end)}`;
}
